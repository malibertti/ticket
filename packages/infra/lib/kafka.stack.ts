import { Duration, Fn, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import {
  IConnectable,
  IVpc,
  Port,
  SecurityGroup,
  SubnetType,
} from 'aws-cdk-lib/aws-ec2';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import {
  AwsLogDriver,
  Cluster,
  ContainerImage,
  CpuArchitecture,
  FargateService,
  FargateTaskDefinition,
  OperatingSystemFamily,
} from 'aws-cdk-lib/aws-ecs';
import { Grant, IGrantable } from 'aws-cdk-lib/aws-iam';
import { LoggingFormat } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { CfnServerlessCluster } from 'aws-cdk-lib/aws-msk';
import {
  DnsRecordType,
  PrivateDnsNamespace,
} from 'aws-cdk-lib/aws-servicediscovery';
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from 'aws-cdk-lib/custom-resources';
import { Trigger } from 'aws-cdk-lib/triggers';
import { Construct } from 'constructs';
import { join } from 'node:path';

interface KafkaStackProps extends StackProps {
  vpc: IVpc;
  ecsCluster: Cluster;
}

export class KafkaStack extends Stack {
  readonly bootstrapBrokers: string;
  readonly schemaRegistryUrl: string;
  private readonly clusterSg: SecurityGroup;
  private readonly registrySg: SecurityGroup;
  private readonly clusterArn: string;
  private readonly clusterName = 'ticket';

  constructor(scope: Construct, id: string, props: KafkaStackProps) {
    super(scope, id, props);

    this.clusterSg = new SecurityGroup(this, 'ClusterSg', {
      vpc: props.vpc,
      allowAllOutbound: false,
    });

    // MSK Serverless
    const cluster = new CfnServerlessCluster(this, 'Msk', {
      clusterName: this.clusterName,
      clientAuthentication: { sasl: { iam: { enabled: true } } },
      vpcConfigs: [
        {
          subnetIds: props.vpc.isolatedSubnets.map((s) => s.subnetId),
          securityGroups: [this.clusterSg.securityGroupId],
        },
      ],
    });

    this.clusterArn = cluster.attrArn;

    // The cluster resource doesn't return its bootstrap address; ask the API once
    const brokers = new AwsCustomResource(this, 'BootstrapBrokers', {
      onUpdate: {
        service: 'Kafka',
        action: 'getBootstrapBrokers',
        parameters: { ClusterArn: cluster.attrArn },
        physicalResourceId: PhysicalResourceId.of(cluster.attrArn),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: [cluster.attrArn],
      }),
      installLatestAwsSdk: false,
    });

    this.bootstrapBrokers = brokers.getResponseField(
      'BootstrapBrokerStringSaslIam',
    );

    // Topics: created on deploy, before the registry starts
    const topicsFn = new NodejsFunction(this, 'TopicsFn', {
      entry: join(__dirname, './lambda/kafka-topics/index.ts'),
      depsLockFilePath: join(__dirname, '../../../pnpm-lock.yaml'),
      vpc: props.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      timeout: Duration.minutes(2),
      logGroup: new LogGroup(this, 'TopicsFnLogs', {
        retention: RetentionDays.THREE_DAYS,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      loggingFormat: LoggingFormat.JSON,
      environment: {
        KAFKA_BROKERS: this.bootstrapBrokers,
      },
    });

    topicsFn.connections.allowTo(this.clusterSg, Port.tcp(9098), 'Kafka (IAM)');

    Grant.addToPrincipal({
      grantee: topicsFn,
      actions: ['kafka-cluster:Connect'],
      resourceArns: [this.clusterArn],
    });

    Grant.addToPrincipal({
      grantee: topicsFn,
      actions: ['kafka-cluster:DescribeTopic', 'kafka-cluster:CreateTopic'],
      resourceArns: [this.arnOf('topic')],
    });

    const topics = new Trigger(this, 'CreateTopics', {
      handler: topicsFn,
      executeAfter: [brokers],
      timeout: Duration.minutes(2),
    });

    // Schema registry: stateless, stores schemas in the _schemas topic
    const namespace = new PrivateDnsNamespace(this, 'Namespace', {
      name: 'ticket.internal',
      vpc: props.vpc,
    });

    this.registrySg = new SecurityGroup(this, 'RegistrySg', {
      vpc: props.vpc,
    });

    const registryTask = new FargateTaskDefinition(this, 'RegistryTask', {
      // cpu: 256,
      memoryLimitMiB: 1024,
      runtimePlatform: {
        cpuArchitecture: CpuArchitecture.ARM64,
        operatingSystemFamily: OperatingSystemFamily.LINUX,
      },
    });

    registryTask.addContainer('registry', {
      image: ContainerImage.fromAsset(
        join(__dirname, '../docker/schema-registry'),
        { platform: Platform.LINUX_ARM64 },
      ),
      portMappings: [{ containerPort: 8081 }],
      environment: {
        SCHEMA_REGISTRY_HOST_NAME: 'schema-registry.ticket.internal',
        SCHEMA_REGISTRY_LISTENERS: 'http://0.0.0.0:8081',
        SCHEMA_REGISTRY_HEAP_OPTS: '-Xms256m -Xmx512m',
        SCHEMA_REGISTRY_KAFKASTORE_BOOTSTRAP_SERVERS: this.bootstrapBrokers,
        SCHEMA_REGISTRY_KAFKASTORE_TOPIC: '_schemas',
        SCHEMA_REGISTRY_KAFKASTORE_SECURITY_PROTOCOL: 'SASL_SSL',
        SCHEMA_REGISTRY_KAFKASTORE_SASL_MECHANISM: 'AWS_MSK_IAM',
        SCHEMA_REGISTRY_KAFKASTORE_SASL_JAAS_CONFIG:
          'software.amazon.msk.auth.iam.IAMLoginModule required;',
        SCHEMA_REGISTRY_KAFKASTORE_SASL_CLIENT_CALLBACK_HANDLER_CLASS:
          'software.amazon.msk.auth.iam.IAMClientCallbackHandler',
      },
      logging: new AwsLogDriver({
        streamPrefix: 'registry',
        logGroup: new LogGroup(this, 'RegistryLogGroup', {
          retention: RetentionDays.THREE_DAYS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
      }),
    });

    this.grantClient(registryTask.taskRole);

    const registry = new FargateService(this, 'RegistryService', {
      cluster: props.ecsCluster,
      taskDefinition: registryTask,
      desiredCount: 1,
      // one instance at a time: two with the same host name would confuse leader election
      minHealthyPercent: 0,
      maxHealthyPercent: 100,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [this.registrySg],
      circuitBreaker: { rollback: true },
      cloudMapOptions: {
        name: 'schema-registry',
        cloudMapNamespace: namespace,
        dnsRecordType: DnsRecordType.A,
        dnsTtl: Duration.seconds(10),
      },
    });

    registry.connections.allowTo(this.clusterSg, Port.tcp(9098), 'Kafka (IAM)');
    registry.node.addDependency(topics);

    this.schemaRegistryUrl = 'http://schema-registry.ticket.internal:8081';
  }

  /** Opens the brokers (9098) and the schema registry (8081) to this service or function only. */
  allowClient(client: IConnectable) {
    client.connections.allowTo(this.clusterSg, Port.tcp(9098), 'Kafka (IAM)');
    client.connections.allowTo(
      this.registrySg,
      Port.tcp(8081),
      'Schema registry',
    );
  }

  /** Connect, produce (idempotent), consume and use consumer groups on this cluster. */
  grantClient(grantee: IGrantable) {
    Grant.addToPrincipal({
      grantee,
      actions: [
        'kafka-cluster:Connect',
        'kafka-cluster:DescribeCluster',
        'kafka-cluster:WriteDataIdempotently',
      ],
      resourceArns: [this.clusterArn],
    });
    Grant.addToPrincipal({
      grantee,
      actions: [
        'kafka-cluster:DescribeTopic',
        'kafka-cluster:DescribeTopicDynamicConfiguration',
        'kafka-cluster:ReadData',
        'kafka-cluster:WriteData',
      ],
      resourceArns: [this.arnOf('topic')],
    });
    Grant.addToPrincipal({
      grantee,
      actions: ['kafka-cluster:DescribeGroup', 'kafka-cluster:AlterGroup'],
      resourceArns: [this.arnOf('group')],
    });
  }

  /** All topics or groups of this cluster: arn:…:topic/<name>/<uuid>/* */
  private arnOf(kind: 'topic' | 'group') {
    const uuid = Fn.select(2, Fn.split('/', this.clusterArn));

    return `arn:${this.partition}:kafka:${this.region}:${this.account}:${kind}/${this.clusterName}/${uuid}/*`;
  }
}

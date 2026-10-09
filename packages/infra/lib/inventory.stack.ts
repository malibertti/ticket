import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import {
  AttributeType,
  BillingMode,
  StreamViewType,
  Table,
} from 'aws-cdk-lib/aws-dynamodb';
import { IVpc, Port, SecurityGroup, SubnetType } from 'aws-cdk-lib/aws-ec2';
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
import { ApplicationTargetGroup } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { LoggingFormat, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { join } from 'node:path';
import { KafkaStack } from './kafka.stack';

interface InventoryStackProps extends StackProps {
  vpc: IVpc;
  ecsCluster: Cluster;
  targetGroup: ApplicationTargetGroup;
  port: number;
  cors: string;
  poolId: string;
  poolClientId: string;
  cacheSg: SecurityGroup;
  cacheUrl: string;
  kafka: KafkaStack;
}

/** Inventory API on ECS, its DynamoDB tables, and the Lambda that publishes stored events to Kafka. */
export class InventoryStack extends Stack {
  constructor(scope: Construct, id: string, props: InventoryStackProps) {
    super(scope, id, props);

    const repoRoot = join(__dirname, '../../..');

    const eventsTable = new Table(this, 'EventsTable', {
      billingMode: BillingMode.PAY_PER_REQUEST,
      stream: StreamViewType.NEW_IMAGE,
      removalPolicy: RemovalPolicy.DESTROY,
      partitionKey: {
        name: 'streamId',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'version',
        type: AttributeType.NUMBER,
      },
    });

    const countersTable = new Table(this, 'CountersTable', {
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      partitionKey: {
        name: 'eventId',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'section',
        type: AttributeType.STRING,
      },
    });

    const taskDefinition = new FargateTaskDefinition(this, 'InventoryTask', {
      // cpu: 256,
      // memoryLimitMiB: 512,
      runtimePlatform: {
        cpuArchitecture: CpuArchitecture.ARM64,
        operatingSystemFamily: OperatingSystemFamily.LINUX,
      },
    });

    const api = taskDefinition.addContainer('api', {
      portMappings: [{ containerPort: props.port }],
      image: ContainerImage.fromAsset(join(repoRoot, 'packages/inventory'), {
        file: 'Dockerfile',
        platform: Platform.LINUX_ARM64,
      }),
      environment: {
        AWS_REGION: this.region,
        PORT: String(props.port),
        CORS_ORIGINS: `https://${props.cors}`,
        LOG_LEVEL: 'info',
        INVENTORY_EVENTS_TABLE: eventsTable.tableName,
        INVENTORY_COUNTERS_TABLE: countersTable.tableName,
        COGNITO_POOL_ID: props.poolId,
        COGNITO_CLIENT_ID: props.poolClientId,
        VALKEY_URL: props.cacheUrl,
        KAFKA_AUTH: 'iam',
        KAFKA_BROKERS: props.kafka.bootstrapBrokers,
        SCHEMA_REGISTRY_URL: props.kafka.schemaRegistryUrl,
      },
      logging: new AwsLogDriver({
        streamPrefix: 'api',
        logGroup: new LogGroup(this, 'InventoryApiLogGroup', {
          retention: RetentionDays.THREE_DAYS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
      }),
    });

    const service = new FargateService(this, 'InventoryApiService', {
      cluster: props.ecsCluster,
      taskDefinition,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      circuitBreaker: { rollback: true },
    });

    service.connections.allowTo(props.cacheSg, Port.tcp(6379));

    eventsTable.grantReadWriteData(taskDefinition.taskRole);
    countersTable.grantReadWriteData(taskDefinition.taskRole);

    props.kafka.allowClient(service);
    props.kafka.grantClient(taskDefinition.taskRole);

    const scaling = service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 4,
    });

    scaling.scaleOnCpuUtilization('Cpu', {
      targetUtilizationPercent: 80,
    });

    scaling.scaleOnRequestCount('Rps', {
      requestsPerTarget: 500,
      targetGroup: props.targetGroup,
    });

    props.targetGroup.addTarget(
      service.loadBalancerTarget({
        containerName: api.containerName,
        containerPort: props.port,
      }),
    );

    // Stream publisher: events table stream → inventory.events.v1
    const publisher = new NodejsFunction(this, 'StreamPublisherFn', {
      entry: join(
        repoRoot,
        'packages/inventory/src/app/publisher/stream.publisher.ts',
      ),
      depsLockFilePath: join(repoRoot, 'pnpm-lock.yaml'),
      bundling: { externalModules: [] },
      vpc: props.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      memorySize: 512,
      timeout: Duration.minutes(2), // kafkajs retries take ~50s before giving up on an unreachable broker
      logGroup: new LogGroup(this, 'StreamPublisherLogs', {
        retention: RetentionDays.THREE_DAYS,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      loggingFormat: LoggingFormat.JSON,
      environment: {
        KAFKA_BROKERS: props.kafka.bootstrapBrokers,
        SCHEMA_REGISTRY_URL: props.kafka.schemaRegistryUrl,
      },
    });

    props.kafka.allowClient(publisher);
    props.kafka.grantClient(publisher);

    publisher.addEventSource(
      new DynamoEventSource(eventsTable, {
        startingPosition: StartingPosition.TRIM_HORIZON,
        batchSize: 100,
        // a failed record stops its batch and is retried until it leaves the stream,
        // so nothing after it is published out of order
        reportBatchItemFailures: true,
        parallelizationFactor: 1,
      }),
    );
  }
}

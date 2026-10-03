import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
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
  Secret,
} from 'aws-cdk-lib/aws-ecs';
import { ApplicationTargetGroup } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Domain } from 'aws-cdk-lib/aws-opensearchservice';
import { DatabaseInstance } from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { join } from 'node:path';

interface CatalogStackProps extends StackProps {
  vpc: IVpc;
  targetGroup: ApplicationTargetGroup;
  db: DatabaseInstance;
  port: number;
  cors: string;
  poolId: string;
  poolClientId: string;
  searchDomain: Domain;
  cacheSg: SecurityGroup;
  cacheUrl: string;
}

export class CatalogStack extends Stack {
  constructor(scope: Construct, id: string, props: CatalogStackProps) {
    super(scope, id, props);

    const repoRoot = join(__dirname, '../../..');

    // ECS
    const cluster = new Cluster(this, 'Cluster', {
      vpc: props.vpc,
    });

    const taskDefinition = new FargateTaskDefinition(this, 'CatalogTask', {
      // cpu: 256,
      // memoryLimitMiB: 512,
      runtimePlatform: {
        cpuArchitecture: CpuArchitecture.ARM64,
        operatingSystemFamily: OperatingSystemFamily.LINUX,
      },
    });

    // Api Container
    const api = taskDefinition.addContainer('api', {
      portMappings: [{ containerPort: props.port }],
      image: ContainerImage.fromAsset(join(repoRoot, 'packages/catalog'), {
        file: 'Dockerfile',
        platform: Platform.LINUX_ARM64,
      }),
      environment: {
        AWS_REGION: this.region,
        PORT: String(props.port),
        CORS_ORIGINS: `https://${props.cors}`,
        DB_USER: 'postgres',
        DB_HOST: props.db.instanceEndpoint.hostname,
        DB_PORT: String(props.db.instanceEndpoint.port),
        DB_NAME: 'ticketing',
        DB_POOL_MAX: '10',
        DB_IDLE_TIMEOUT_MS: '10000',
        DB_SSL: 'true',
        LOG_LEVEL: 'info',
        // LOG_PRETTY: false,
        COGNITO_POOL_ID: props.poolId,
        COGNITO_CLIENT_ID: props.poolClientId,
        OPENSEARCH_URL: `https://${props.searchDomain.domainEndpoint}`,
        OPENSEARCH_AUTH: 'aws',
        OPENSEARCH_REPLICAS: '0',
        VALKEY_URL: props.cacheUrl,
      },
      secrets: {
        DB_PASSWORD: Secret.fromSecretsManager(props.db.secret!, 'password'),
      },
      logging: new AwsLogDriver({
        streamPrefix: 'api',
        logGroup: new LogGroup(this, 'ApiLogGroup', {
          retention: RetentionDays.THREE_DAYS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
      }),
    });

    // ECS Service
    const service = new FargateService(this, 'ApiService', {
      cluster,
      taskDefinition,
      // desiredCount: 2,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      circuitBreaker: { rollback: true },
    });

    service.connections.allowTo(props.db, Port.tcp(5432));
    service.connections.allowTo(props.searchDomain, Port.tcp(443));
    service.connections.allowTo(props.cacheSg, Port.tcp(6379));

    props.searchDomain.grantReadWrite(taskDefinition.taskRole);

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

    // Register api container in target group
    props.targetGroup.addTarget(
      service.loadBalancerTarget({
        containerName: api.containerName,
        containerPort: props.port,
      }),
    );
  }
}

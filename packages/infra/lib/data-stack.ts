import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import {
  InstanceClass,
  InstanceSize,
  InstanceType,
  IVpc,
  SecurityGroup,
  SubnetType,
} from 'aws-cdk-lib/aws-ec2';
import {
  Credentials,
  DatabaseInstance,
  DatabaseInstanceEngine,
  ParameterGroup,
  PostgresEngineVersion,
  StorageType,
} from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

interface DataStackProps extends StackProps {
  vpc: IVpc;
}

export class DataStack extends Stack {
  readonly db: DatabaseInstance;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const dbSg = new SecurityGroup(this, 'DbSg', {
      vpc: props.vpc,
      allowAllOutbound: false,
    });

    this.db = new DatabaseInstance(this, 'DbPostgres', {
      databaseName: 'ticketing',
      vpc: props.vpc,
      securityGroups: [dbSg],
      vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      engine: DatabaseInstanceEngine.postgres({
        version: PostgresEngineVersion.VER_18_3,
      }),
      instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.MICRO),
      storageType: StorageType.GP3,
      allocatedStorage: 20,
      maxAllocatedStorage: 50,
      credentials: Credentials.fromGeneratedSecret('postgres'),
      parameterGroup: new ParameterGroup(this, 'Params', {
        engine: DatabaseInstanceEngine.postgres({
          version: PostgresEngineVersion.VER_18_3,
        }),
        parameters: { 'rds.logical_replication': '1' },
      }),
      backupRetention: Duration.days(0),
      deleteAutomatedBackups: true,
      // deletionProtection: true,
      removalPolicy: RemovalPolicy.DESTROY,
      multiAz: false,
      publiclyAccessible: false,
      iamAuthentication: true,
    });
  }
}

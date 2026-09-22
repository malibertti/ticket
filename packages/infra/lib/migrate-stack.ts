import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { IVpc, Port, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { LoggingFormat } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { DatabaseInstance } from 'aws-cdk-lib/aws-rds';
import { Trigger } from 'aws-cdk-lib/triggers';
import { Construct } from 'constructs';
import { join } from 'node:path';

interface MigrateStackProps extends StackProps {
  vpc: IVpc;
  db: DatabaseInstance;
  // fnsSg: SecurityGroup;
}

export class MigrateStack extends Stack {
  readonly migrationTrigger: Trigger;

  constructor(scope: Construct, id: string, props: MigrateStackProps) {
    super(scope, id, props);

    const fn = new NodejsFunction(this, 'MigrateFn', {
      entry: join(__dirname, './lambda/migrate/index.ts'),
      depsLockFilePath: join(__dirname, '../../../pnpm-lock.yaml'),
      vpc: props.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      // securityGroups: [props.fnsSg],
      timeout: Duration.minutes(5),
      bundling: {
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling(inputDir, outputDir) {
            return [
              `cp -r ${inputDir}/packages/catalog/src/assets/migrations ${outputDir}/migrations`,
            ];
          },
        },
      },
      logGroup: new LogGroup(this, 'MigrateFnLogs', {
        retention: RetentionDays.THREE_DAYS,
      }),
      loggingFormat: LoggingFormat.JSON,
      environment: {
        DB_SECRET_ARN: props.db.secret!.secretArn,
        DB_SSL: 'true',
        DB_USER: 'postgres',
        DB_HOST: props.db.instanceEndpoint.hostname,
        DB_PORT: String(props.db.instanceEndpoint.port),
        DB_NAME: 'ticketing',
      },
    });

    fn.connections.allowTo(props.db, Port.tcp(5432));
    props.db.secret!.grantRead(fn);

    this.migrationTrigger = new Trigger(this, 'RunMigration', {
      handler: fn,
      executeAfter: [props.db],
      timeout: Duration.minutes(5),
    });
  }
}

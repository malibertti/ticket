import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import {
  FlowLogDestination,
  FlowLogTrafficType,
  GatewayVpcEndpointAwsService,
  IVpc,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface NetworkStackProps extends StackProps {
  //
}

export class NetworkStack extends Stack {
  readonly vpc: IVpc;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    // VPC
    this.vpc = new Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: SubnetType.PUBLIC, cidrMask: 26 },
        { name: 'private', subnetType: SubnetType.PRIVATE_WITH_EGRESS },
        { name: 'isolated', subnetType: SubnetType.PRIVATE_ISOLATED },
      ],
    });

    this.vpc.addGatewayEndpoint('S3', {
      service: GatewayVpcEndpointAwsService.S3,
      subnets: [{ subnetType: SubnetType.PRIVATE_WITH_EGRESS }],
    });

    this.vpc.addFlowLog('FlowLog', {
      trafficType: FlowLogTrafficType.REJECT,
      destination: FlowLogDestination.toCloudWatchLogs(
        new LogGroup(this, 'FlowLogs', {
          retention: RetentionDays.THREE_DAYS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
      ),
    });
  }
}

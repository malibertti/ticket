import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { EbsDeviceVolumeType, IVpc, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import {
  CfnParameterGroup,
  CfnReplicationGroup,
  CfnSubnetGroup,
} from 'aws-cdk-lib/aws-elasticache';
import { Domain, EngineVersion } from 'aws-cdk-lib/aws-opensearchservice';
import { Construct } from 'constructs';

interface SearchStackProps extends StackProps {
  vpc: IVpc;
}

export class SearchStack extends Stack {
  readonly searchDomain: Domain;
  readonly cacheSg: SecurityGroup;
  readonly cacheUrl: string;

  constructor(scope: Construct, id: string, props: SearchStackProps) {
    super(scope, id, props);

    this.searchDomain = new Domain(this, 'Search', {
      vpc: props.vpc,
      version: EngineVersion.OPENSEARCH_3_5,
      vpcSubnets: [{ subnets: [props.vpc.isolatedSubnets[0]] }],
      capacity: {
        dataNodes: 1,
        dataNodeInstanceType: 't3.small.search',
        multiAzWithStandbyEnabled: false,
      },
      zoneAwareness: { enabled: false },
      ebs: {
        volumeSize: 10,
        volumeType: EbsDeviceVolumeType.GP3,
      },
      enforceHttps: true,
      nodeToNodeEncryption: true,
      encryptionAtRest: { enabled: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.cacheSg = new SecurityGroup(this, 'CacheSg', {
      vpc: props.vpc,
      allowAllOutbound: false,
    });

    const cache = new CfnReplicationGroup(this, 'Valkey', {
      replicationGroupDescription: 'BullMQ queues',
      engine: 'valkey',
      engineVersion: '9.1',
      cacheNodeType: 'cache.t4g.micro',
      numCacheClusters: 1,
      automaticFailoverEnabled: false,
      transitEncryptionEnabled: true,
      cacheSubnetGroupName: new CfnSubnetGroup(this, 'CacheSubnets', {
        description: 'Valkey subnets',
        subnetIds: props.vpc.isolatedSubnets.map((s) => s.subnetId),
      }).ref,
      cacheParameterGroupName: new CfnParameterGroup(this, 'CacheParams', {
        cacheParameterGroupFamily: 'valkey9',
        description: 'BullMQ requires noeviction',
        properties: { 'maxmemory-policy': 'noeviction' },
      }).ref,
      securityGroupIds: [this.cacheSg.securityGroupId],
      atRestEncryptionEnabled: true,
    });

    this.cacheUrl = `rediss://${cache.attrPrimaryEndPointAddress}:${cache.attrPrimaryEndPointPort}`;
  }
}

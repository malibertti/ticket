import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  OriginProtocolPolicy,
  OriginRequestPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { VpcOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { IVpc, Port, PrefixList, SubnetType } from 'aws-cdk-lib/aws-ec2';
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  TargetType,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { CfnWebACL } from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

interface GatewayStackProps extends StackProps {
  vpc: IVpc;
  apiDomain: string;
  apiCert: string;
  apiPort: number;
}

export class GatewayStack extends Stack {
  readonly targetGroup: ApplicationTargetGroup;
  readonly dist: Distribution;

  constructor(scope: Construct, id: string, props: GatewayStackProps) {
    super(scope, id, props);

    // ALB
    const alb = new ApplicationLoadBalancer(this, 'Alb', {
      vpc: props.vpc,
      internetFacing: false,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
    });

    alb.connections.allowFrom(
      PrefixList.fromLookup(this, 'CloudFrontOriginFacing', {
        prefixListName: 'com.amazonaws.global.cloudfront.origin-facing',
      }),
      Port.tcp(80),
    );

    const listener = alb.addListener('Http', {
      port: 80,
      protocol: ApplicationProtocol.HTTP,
      open: false,
    });

    this.targetGroup = new ApplicationTargetGroup(this, 'ApiTargets', {
      vpc: props.vpc,
      port: props.apiPort,
      protocol: ApplicationProtocol.HTTP,
      targetType: TargetType.IP,
      deregistrationDelay: Duration.seconds(30),
      healthCheck: {
        path: '/health',
        healthyHttpCodes: '200',
        interval: Duration.seconds(30),
      },
    });

    listener.addTargetGroups('Default', {
      targetGroups: [this.targetGroup],
    });

    // WAF
    const visibility = (metricName: string) => {
      return {
        metricName,
        cloudWatchMetricsEnabled: true,
        sampledRequestsEnabled: true,
      };
    };

    const acl = new CfnWebACL(this, 'ApiAcl', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: visibility('ApiAcl'),
      rules: [
        {
          name: 'RateLimit',
          priority: 0,
          action: { block: {} },
          visibilityConfig: visibility('RateLimit'),
          statement: {
            rateBasedStatement: {
              limit: 2000,
              evaluationWindowSec: 120,
              aggregateKeyType: 'IP',
            },
          },
        },
        {
          name: 'Common',
          priority: 1,
          overrideAction: { none: {} },
          visibilityConfig: visibility('Common'),
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
        },
        {
          name: 'BlockInternal',
          priority: 0,
          action: { block: {} },
          visibilityConfig: visibility('BlockInternal'),
          statement: {
            regexMatchStatement: {
              regexString: '^/internal(/|$)',
              fieldToMatch: { uriPath: {} },
              textTransformations: [{ priority: 0, type: 'NONE' }],
            },
          },
        },
      ],
    });

    // CloudFront
    const origin = VpcOrigin.withApplicationLoadBalancer(alb, {
      protocolPolicy: OriginProtocolPolicy.HTTP_ONLY,
      httpPort: 80,
      originShieldEnabled: true,
      originShieldRegion: this.region,
    });

    this.dist = new Distribution(this, 'EdgeDist', {
      domainNames: [props.apiDomain],
      webAclId: acl.attrArn,
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_ALL,
        cachePolicy: CachePolicy.CACHING_DISABLED,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      certificate: Certificate.fromCertificateArn(
        this,
        'ApiCert',
        props.apiCert,
      ),
    });

    const zone = HostedZone.fromLookup(this, 'ApiZone', {
      domainName: props.apiDomain,
      privateZone: false,
    });

    const target = RecordTarget.fromAlias(new CloudFrontTarget(this.dist));

    new ARecord(this, 'ApiAlias', { zone, target });
  }
}

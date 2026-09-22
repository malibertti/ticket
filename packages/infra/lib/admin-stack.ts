import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Distribution, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { join } from 'node:path';

interface AdminStackProps extends StackProps {
  adminDomain: string;
  adminCert: string;
}

export class AdminStack extends Stack {
  constructor(scope: Construct, id: string, props: AdminStackProps) {
    super(scope, id, props);

    const bucket = new Bucket(this, 'Admin', {
      publicReadAccess: false,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      enforceSSL: true,
    });

    const dist = new Distribution(this, 'UrlShortenerDist', {
      domainNames: [props.adminDomain],
      defaultRootObject: 'index.html',
      certificate: Certificate.fromCertificateArn(
        this,
        'AdminCert',
        props.adminCert,
      ),
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    new BucketDeployment(this, 'AdminDeploy', {
      sources: [Source.asset(join(__dirname, '../../admin/dist'))],
      destinationBucket: bucket,
      distribution: dist,
      distributionPaths: ['/*'],
      logGroup: new LogGroup(this, 'AdminDeployLogs', {
        retention: RetentionDays.THREE_DAYS,
      }),
    });

    const zone = HostedZone.fromLookup(this, 'AdminZone', {
      domainName: props.adminDomain,
      privateZone: false,
    });

    new ARecord(this, 'AdminAliasRecord', {
      zone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(dist)),
    });

    new CfnOutput(this, 'AdminUrl', {
      value: `https://${props.adminDomain}`,
    });

    new CfnOutput(this, 'AdminUrlCloudFrontDomain', {
      value: `https://${dist.distributionDomainName}`,
    });
  }
}

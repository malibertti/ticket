#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { InfraStack } from '../lib/infra-stack';

const env = {
  account: process.env.CDK_ACCOUNT_ID,
  region: process.env.AWS_REGION,
};

const app = new cdk.App();

new InfraStack(app, 'InfraStack', {
  env,
});

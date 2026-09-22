#!/usr/bin/env node
import { App, Tags } from 'aws-cdk-lib';
import { DevStage } from '../lib/dev-stage';

process.loadEnvFile();

const app = new App();
Tags.of(app).add('project', 'ticket');
Tags.of(app).add('managed-by', 'cdk');

const dev = new DevStage(app, 'Dev', {
  env: {
    account: process.env.CDK_ACCOUNT_ID,
    region: process.env.AWS_REGION,
  },
  apiDomain: process.env.API_DOMAIN!,
  apiCert: process.env.API_CERT!,
  apiPort: +process.env.API_PORT!,
  adminDomain: process.env.ADMIN_DOMAIN!,
  adminCert: process.env.ADMIN_CERT!,
  // webDomain: process.env.WEB_DOMAIN!,
  // webCert: process.env.WEB_CERT!,
});
Tags.of(dev).add('stage', 'dev');

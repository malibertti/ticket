import { Stage, StageProps, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AdminStack } from './admin-stack';
import { AuthStack } from './auth-stack';
import { CatalogStack } from './catalog-stack';
import { DataStack } from './data-stack';
import { EdgeStack } from './edge-stack';
import { MigrateStack } from './migrate-stack';
import { NetworkStack } from './network-stack';

interface DevStageProps extends StageProps {
  apiDomain: string;
  apiCert: string;
  apiPort: number;
  // webDomain: string;
  // webCert: string;
  adminDomain: string;
  adminCert: string;
}

export class DevStage extends Stage {
  constructor(scope: Construct, id: string, props: DevStageProps) {
    super(scope, id, props);

    const network = new NetworkStack(this, 'NetworkStack', {
      env: props.env,
    });
    Tags.of(network).add('component', 'network');

    const admin = new AdminStack(this, 'AdminStack', {
      env: props.env,
      adminDomain: props.adminDomain,
      adminCert: props.adminCert,
      terminationProtection: true,
    });
    Tags.of(admin).add('component', 'admin');

    const auth = new AuthStack(this, 'AuthStack', {
      env: props.env,
      adminDomain: props.adminDomain,
      terminationProtection: true,
    });
    Tags.of(auth).add('component', 'auth');

    const edge = new EdgeStack(this, 'EdgeStack', {
      env: props.env,
      vpc: network.vpc,
      apiDomain: props.apiDomain,
      apiCert: props.apiCert,
      apiPort: props.apiPort,
      albSg: network.albSg,
    });
    Tags.of(edge).add('component', 'edge');

    const data = new DataStack(this, 'DataStack', {
      env: props.env,
      vpc: network.vpc,
    });
    Tags.of(data).add('component', 'data');

    const migrate = new MigrateStack(this, 'MigrateStack', {
      env: props.env,
      vpc: network.vpc,
      db: data.db,
    });
    Tags.of(migrate).add('component', 'migrate');

    const catalog = new CatalogStack(this, 'CatalogStack', {
      env: props.env,
      vpc: network.vpc,
      targetGroup: edge.targetGroup,
      port: props.apiPort,
      cors: props.adminDomain,
      db: data.db,
      poolId: auth.userPool.userPoolId,
      poolClientId: auth.userPoolClient.userPoolClientId,
    });
    Tags.of(catalog).add('component', 'catalog');

    catalog.node.addDependency(migrate);
  }
}

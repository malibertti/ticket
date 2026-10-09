import { Stage, StageProps, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AdminStack } from './admin-stack';
import { AuthStack } from './auth-stack';
import { CatalogStack } from './catalog-stack';
import { DataStack } from './data-stack';
import { GatewayStack } from './gateway-stack';
import { InventoryStack } from './inventory.stack';
import { KafkaStack } from './kafka.stack';
import { MigrateStack } from './migrate-stack';
import { NetworkStack } from './network-stack';
import { SearchStack } from './search-stack';

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

    const data = new DataStack(this, 'DataStack', {
      env: props.env,
      vpc: network.vpc,
    });
    Tags.of(data).add('component', 'data');

    const gateway = new GatewayStack(this, 'GatewayStack', {
      env: props.env,
      vpc: network.vpc,
      apiDomain: props.apiDomain,
      apiCert: props.apiCert,
      apiPort: props.apiPort,
    });
    Tags.of(gateway).add('component', 'gateway');

    const migrate = new MigrateStack(this, 'MigrateStack', {
      env: props.env,
      vpc: network.vpc,
      db: data.db,
    });
    Tags.of(migrate).add('component', 'migrate');

    const search = new SearchStack(this, 'SearchStack', {
      env: props.env,
      vpc: network.vpc,
    });
    Tags.of(search).add('component', 'search');

    const kafka = new KafkaStack(this, 'KafkaStack', {
      env: props.env,
      vpc: network.vpc,
      ecsCluster: network.ecsCluster,
    });
    Tags.of(kafka).add('component', 'kafka');

    const catalog = new CatalogStack(this, 'CatalogStack', {
      env: props.env,
      vpc: network.vpc,
      ecsCluster: network.ecsCluster,
      targetGroup: gateway.catalogTg,
      port: props.apiPort,
      cors: props.adminDomain,
      db: data.db,
      poolId: auth.userPool.userPoolId,
      poolClientId: auth.userPoolClient.userPoolClientId,
      searchDomain: search.searchDomain,
      cacheSg: search.cacheSg,
      cacheUrl: search.cacheUrl,
      kafka,
    });
    Tags.of(catalog).add('component', 'catalog');

    catalog.node.addDependency(migrate);

    const inventory = new InventoryStack(this, 'InventoryStack', {
      env: props.env,
      vpc: network.vpc,
      ecsCluster: network.ecsCluster,
      targetGroup: gateway.inventoryTg,
      port: props.apiPort,
      cors: props.adminDomain,
      poolId: auth.userPool.userPoolId,
      poolClientId: auth.userPoolClient.userPoolClientId,
      cacheSg: search.cacheSg,
      cacheUrl: search.cacheUrl,
      kafka,
    });
    Tags.of(inventory).add('component', 'inventory');
  }
}

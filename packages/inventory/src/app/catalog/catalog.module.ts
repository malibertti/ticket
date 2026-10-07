import { Module } from '@nestjs/common';
import { KafkaModule } from '@org/shared/kafka';
import { DbModule } from '../db/db.module';
import { EnvService } from '../env/env.service';
import { CatalogConsumer } from './catalog.consumer';

@Module({
  imports: [
    DbModule,
    KafkaModule.forRootAsync({
      inject: [EnvService],
      useFactory(env: EnvService) {
        return {
          clientId: 'inventory',
          brokers: env.get('KAFKA_BROKERS').split(','),
          schemaRegistryUrl: env.get('SCHEMA_REGISTRY_URL'),
        };
      },
    }),
  ],
  providers: [CatalogConsumer],
})
export class CatalogModule {}

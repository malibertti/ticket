import { Module } from '@nestjs/common';
import { AuthModule } from '@org/shared/auth';
import { HealthModule } from '@org/shared/health';
import { KafkaModule } from '@org/shared/kafka';
import { LoggerModule } from '@org/shared/logger';
import { CatalogConsumer } from './catalog.consumer';
import { DbModule } from './db/db.module';
import { EnvModule } from './env/env.module';
import { EnvService } from './env/env.service';
import { HoldsModule } from './holds/holds.module';
import { PublisherModule } from './publisher/publisher.module';

@Module({
  imports: [
    EnvModule,
    LoggerModule.forRoot('inventory'),
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
    AuthModule,
    DbModule,
    HealthModule,
    HoldsModule,
    PublisherModule,
  ],
  controllers: [],
  providers: [CatalogConsumer],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { KafkaModule } from '@org/shared/kafka';
import { DbModule } from '../db/db.module';
import { EnvService } from '../env/env.service';
import { OutboxPoller } from './outbox.poller';
import { OutboxService } from './outbox.service';

@Module({
  imports: [
    DbModule,
    KafkaModule.forRootAsync({
      inject: [EnvService],
      useFactory(env: EnvService) {
        return {
          clientId: 'catalog',
          brokers: env.get('KAFKA_BROKERS').split(','),
          schemaRegistryUrl: env.get('SCHEMA_REGISTRY_URL'),
          awsRegion:
            env.get('KAFKA_AUTH') === 'iam' ? env.get('AWS_REGION') : undefined,
        };
      },
    }),
  ],
  providers: [OutboxService, OutboxPoller],
  exports: [OutboxService],
})
export class OutboxModule {}

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createIORedisClient, RedisConnection } from 'bullmq';
import { Valkey } from 'iovalkey';
import { FLOWS, QUEUES } from './constants';
import { ReindexProducer } from './ReindexProducer';
import { SeedProducer } from './SeedProducer';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory(cs: ConfigService) {
        RedisConnection.clientFactory = (opts) =>
          createIORedisClient(new Valkey(opts));

        const url = new URL(cs.get('VALKEY_QUEUE_URL')!);

        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
            tls: url.protocol === 'rediss:' ? {} : undefined,
          },
          defaultJobOptions: {
            removeOnComplete: { age: 24 * 3600, count: 100 },
            removeOnFail: { age: 7 * 24 * 3600 },
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: QUEUES.search }, //
      { name: QUEUES.seed },
    ),
    BullModule.registerFlowProducer({
      name: FLOWS.seedThenReindex,
    }),
  ],
  providers: [
    ReindexProducer, //
    SeedProducer,
  ],
  exports: [
    BullModule, //
    ReindexProducer,
    SeedProducer,
  ],
})
export class QueuesModule {}

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { createIORedisClient, RedisConnection } from 'bullmq';
import { Valkey } from 'iovalkey';
import { EnvService } from '../env/env.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [EnvService],
      useFactory(env: EnvService) {
        RedisConnection.clientFactory = (opts) =>
          createIORedisClient(new Valkey(opts));

        const url = new URL(env.get('VALKEY_QUEUE_URL')!);

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
  ],
})
export class QueuesModule {}

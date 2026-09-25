import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { createIORedisClient, RedisConnection } from 'bullmq';
import { Valkey } from 'iovalkey';
import { DbModule } from '../db/db.module';
import { SEARCH, SEARCH_QUEUE } from './constants';
import { ReindexController } from './reindex.controller';
import { ReindexService } from './reindex.service';
import { SearchController } from './search.controller';
import { SearchProcessor } from './search.processor';
import { SearchService } from './search.service';

@Module({
  providers: [
    {
      inject: [ConfigService],
      provide: SEARCH,
      useFactory(cs: ConfigService) {
        const common = {
          node: cs.get('OPENSEARCH_URL'),
          requestTimeout: 2_000,
          maxRetries: 1,
        };

        if (cs.get('OPENSEARCH_AUTH') === 'none') {
          return new Client(common);
        }

        return new Client({
          ...common,
          ...AwsSigv4Signer({
            region: cs.get('AWS_REGION')!,
            service: 'es',
            getCredentials: defaultProvider(),
          }),
        });
      },
    },
    SearchService,
    SearchProcessor,
    ReindexService,
  ],
  imports: [
    DbModule,
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
    BullModule.registerQueue({ name: SEARCH_QUEUE }),
  ],
  controllers: [SearchController, ReindexController],
  exports: [SearchService],
})
export class SearchModule {}

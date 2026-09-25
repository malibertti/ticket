import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { DbModule } from '../db/db.module';
import { QueuesModule } from '../queues/queues.module';
import { SEARCH } from './constants';
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
  imports: [DbModule, QueuesModule],
  controllers: [SearchController, ReindexController],
  exports: [SearchService],
})
export class SearchModule {}

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';
import { SearchEventsQuery } from '@org/contracts';
import {
  EVENTS_ALIAS,
  EVENTS_INDEX_V1,
  EVENTS_MAPPING,
  SEARCH,
} from './constants';
import { EventDoc } from './utils/eventDoc';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @Inject(SEARCH) private readonly client: Client,
    private readonly cs: ConfigService,
  ) {}

  async onModuleInit() {
    const { body } = await this.client.indices.existsAlias({
      name: EVENTS_ALIAS,
    });

    if (!body) {
      this.logger.log('Index not found, creating');

      try {
        await this.client.indices.create({
          index: EVENTS_INDEX_V1,
          body: {
            mappings: EVENTS_MAPPING,
            aliases: {
              [EVENTS_ALIAS]: {},
            },
            settings: {
              number_of_replicas: this.cs.getOrThrow('OPENSEARCH_REPLICAS'),
              analysis: {
                normalizer: {
                  folded: {
                    type: 'custom',
                    filter: ['lowercase', 'asciifolding'],
                  },
                },
              },
            },
          },
        });
        this.logger.log(
          { index: EVENTS_ALIAS, alias: EVENTS_ALIAS },
          'Index created',
        );
      } catch (err: any) {
        if (
          err?.meta?.body?.error?.type !== 'resource_already_exists_exception'
        )
          throw err;
      }
    }
  }

  indexEvent(doc: EventDoc) {
    return this.client.index({
      index: EVENTS_ALIAS,
      id: doc.id,
      body: doc,
    });
  }

  async searchEvents({ q, city, page, limit }: SearchEventsQuery) {
    const res = await this.client.search({
      index: EVENTS_ALIAS,
      body: {
        from: (page - 1) * limit,
        size: limit,
        query: {
          bool: {
            must: q
              ? [
                  {
                    multi_match: {
                      query: q,
                      fields: ['title^3', 'venueName'],
                      fuzziness: 'AUTO',
                    },
                  },
                ]
              : [],
            filter: [
              { range: { startsAt: { gte: 'now' } } },
              ...(city ? [{ term: { city } }] : []),
            ],
          },
        },
        sort: q ? ['_score', { startsAt: 'asc' }] : [{ startsAt: 'asc' }],
      },
    });

    const hits = res.body.hits;
    const htotals = hits.total;
    const total = (typeof htotals === 'number' ? htotals : htotals?.value) ?? 0;
    const items = hits.hits.map((h) => h._source);
    const totalPages = Math.ceil(total / limit);

    return {
      items,
      page,
      limit,
      total,
      totalPages,
    };
  }
}

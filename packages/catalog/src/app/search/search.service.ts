import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import { SearchEventsQuery } from '@org/contracts';
import { SEARCH } from './constants';
import { EventDocument } from './events.document';
import { EVENTS_ALIAS, EVENTS_INDEX_V1, eventsMapping } from './events.index';

@Injectable()
export class SearchService implements OnModuleInit {
  constructor(@Inject(SEARCH) private readonly client: Client) {}

  async onModuleInit() {
    const { body } = await this.client.indices.existsAlias({
      name: EVENTS_ALIAS,
    });

    if (!body) {
      await this.client.indices.create({
        index: EVENTS_INDEX_V1,
        body: {
          mappings: eventsMapping,
          aliases: {
            [EVENTS_ALIAS]: {},
          },
        },
      });
    }
  }

  indexEvent(doc: EventDocument) {
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

    return {
      items: hits.hits.map((h) => h._source),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}

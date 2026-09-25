import { IndexSettingsAnalysis } from '@opensearch-project/opensearch/api/_types/indices._common.js';

export const SEARCH = Symbol('SEARCH');

export const EVENTS_ALIAS = 'events';
export const EVENTS_INDEX_V1 = 'events_v1';

export const REINDEX_JOB = 'reindex';
export const REINDEX_DEDUP_ID = 'search-reindex';

export const EVENTS_MAPPING = {
  dynamic: 'strict',
  properties: {
    id: { type: 'keyword' },
    title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
    venueId: { type: 'keyword' },
    venueName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
    city: { type: 'keyword', normalizer: 'folded' },
    startsAt: { type: 'date' },
    onSaleAt: { type: 'date' },
    status: { type: 'keyword' },
    location: { type: 'geo_point' },
  },
} as const;

export const indexSettingsAnalysis: IndexSettingsAnalysis = {
  normalizer: {
    folded: {
      type: 'custom',
      filter: ['lowercase', 'asciifolding'],
    },
  },
};

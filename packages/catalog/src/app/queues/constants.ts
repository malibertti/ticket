export const QUEUES = {
  search: 'search',
  seed: 'seed',
} as const;

export const JOBS = {
  reindex: 'reindex',
  seed: 'seed',
} as const;

export const DEDUP = {
  reindex: 'search-reindex',
  seed: 'db-seed',
} as const;

export const FLOWS = {
  seedThenReindex: 'seed-then-reindex',
} as const;

export type JobContext = {
  requestId?: string;
};

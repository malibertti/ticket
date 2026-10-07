import { sql } from 'drizzle-orm';
import { bigserial, index, jsonb, text, timestamp } from 'drizzle-orm/pg-core';
import { catalog } from './schema.js';

/**
 * Events waiting to reach Kafka. Written in the same transaction as the change they describe,
 * so an event is never published for a change that rolled back, and never lost for one that committed.
 */
export const outbox = catalog.table(
  'outbox',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    topic: text('topic').notNull(),
    key: text('key').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => [
    // the poller's only query: unpublished rows, oldest first
    index('outbox_unpublished_idx')
      .on(t.id)
      .where(sql`${t.publishedAt} IS NULL`),
  ],
);

export type OutboxRow = typeof outbox.$inferSelect;

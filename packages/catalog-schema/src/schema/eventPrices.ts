import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import z from 'zod';
import { events } from './events.js';
import { catalog } from './schema.js';

export const DEFAULT_SALES_CURRENCY = 'USD';

export const eventPrices = catalog.table(
  'event_prices',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    section: text('section').notNull(),
    priceCents: integer('price_cents').notNull(),
    currency: text('currency').notNull().default(DEFAULT_SALES_CURRENCY),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({
      columns: [t.eventId, t.section],
    }),
    check('event_prices_non_negative', sql`${t.priceCents} >= 0`),
    check(
      'event_prices_currency_usd',
      sql`${t.currency} = ${DEFAULT_SALES_CURRENCY}`,
    ),
  ],
);

export const createEventPrices = createInsertSchema(eventPrices).omit({
  eventId: true,
  currency: true,
  updatedAt: true,
});

export type EventPricesInput = z.infer<typeof createEventPrices>;

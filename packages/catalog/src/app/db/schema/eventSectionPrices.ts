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
import { events } from './events';
import { catalog } from './schema';

export const DEFAULT_SALES_CURRENCY = 'USD';

export const eventSectionPrices = catalog.table(
  'event_section_prices',
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
    check('event_section_prices_non_negative', sql`${t.priceCents} >= 0`),
    check(
      'event_section_prices_currency_usd',
      sql`${t.currency} = ${DEFAULT_SALES_CURRENCY}`,
    ),
  ],
);

export const createEventSectionPrices = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
});

export type EventSectionPricesInput = z.infer<typeof createEventSectionPrices>;

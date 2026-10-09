import { sql } from 'drizzle-orm';
import { text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import z from 'zod';
import { catalog } from './schema.js';
import { venues } from './venues.js';

export const events = catalog.table('events', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`),
  venueId: uuid('venue_id')
    .notNull()
    .references(() => venues.id),
  title: text('title').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  onSaleAt: timestamp('on_sale_at', { withTimezone: true }).notNull(),
  status: text('status', { enum: ['draft', 'on_sale'] })
    .notNull()
    .default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const updateEventInput = createUpdateSchema(events)
  .omit({
    id: true,
    venueId: true,
    createdAt: true,
  })
  .extend({
    status: z.literal('draft').optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');

export const createEventInput = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
  status: true,
});

export type CreateEventInput = z.infer<typeof createEventInput>;
export type UpdateEventInput = z.infer<typeof updateEventInput>;

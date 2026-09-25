import { sql } from 'drizzle-orm';
import {
  check,
  doublePrecision,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const venues = pgTable(
  'venues',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    city: text('city').notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    seatMapVersion: integer('seat_map_version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check('venues_lat_range', sql`${t.latitude} BETWEEN -90 AND 90`),
    check('venues_lng_range', sql`${t.longitude} BETWEEN -180 AND 180`),
  ],
);

export const seatMapEntries = pgTable(
  'seat_map_entries',
  {
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id),
    section: text('section').notNull(),
    rowLabel: text('row_label').notNull(),
    seatNumber: integer('seat_number').notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.venueId, t.section, t.rowLabel, t.seatNumber],
    }),
  ],
);

export const events = pgTable('events', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`),
  venueId: uuid('venue_id')
    .notNull()
    .references(() => venues.id),
  title: text('title').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  onSaleAt: timestamp('on_sale_at', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

import { sql } from 'drizzle-orm';
import {
  check,
  doublePrecision,
  integer,
  jsonb,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import z from 'zod';
import { VenueLayout, venueLayoutSchema } from '../types/venues.js';
import { catalog } from './schema.js';

export const venues = catalog.table(
  'venues',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    city: text('city').notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    layoutVersion: integer('layout_version').notNull().default(1),
    layout: jsonb('layout').$type<VenueLayout>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check('venues_lat_range', sql`${t.latitude} BETWEEN -90 AND 90`),
    check('venues_lng_range', sql`${t.longitude} BETWEEN -180 AND 180`),
  ],
);

export const createVenueInput = createInsertSchema(venues, {
  layout: venueLayoutSchema,
}).omit({
  id: true,
  createdAt: true,
});

export type CreateVenueInput = z.infer<typeof createVenueInput>;

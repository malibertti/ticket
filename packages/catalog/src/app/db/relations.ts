import { defineRelations } from 'drizzle-orm';
import * as schema from './schema.js';

export const relations = defineRelations(schema, (r) => ({
  // venues: {
  //   events: r.many.events(),
  //   seatMapEntries: r.many.seatMapEntries(),
  // },
  // events: {
  //   venue: r.one.venues({
  //     from: r.events.venueId,
  //     to: r.venues.id,
  //   }),
  // },
  // seatMapEntries: {
  //   venue: r.one.venues({
  //     from: r.seatMapEntries.venueId,
  //     to: r.venues.id,
  //   }),
  // },
}));

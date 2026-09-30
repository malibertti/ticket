import { defineRelations } from 'drizzle-orm';
import * as schema from './schema';

export const relations = defineRelations(schema, () => ({
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

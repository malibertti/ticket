import { defineRelations } from 'drizzle-orm';
import { eventPrices } from './eventPrices.js';
import { events } from './events.js';
import { venues } from './venues.js';

export const relations = defineRelations(
  { venues, events, eventPrices },
  () => ({}),
);

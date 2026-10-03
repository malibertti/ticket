import { z } from 'zod';
import { venueLayoutSchema } from './venues.js';

/**
 * An on-sale event's manifest: its layout and the price of each section (USD cents).
 * Catalog writes it to Valkey; inventory reads it on every hold.
 */
export const manifestSchema = z.object({
  eventId: z.uuid(),
  layout: venueLayoutSchema,
  prices: z.record(z.string(), z.number().int().nonnegative()),
});

export type Manifest = z.infer<typeof manifestSchema>;

/** Valkey key shared by both services. Bump the version if the manifest's shape changes. */
export function manifestKey(eventId: string): string {
  return `manifest:v1:${eventId}`;
}

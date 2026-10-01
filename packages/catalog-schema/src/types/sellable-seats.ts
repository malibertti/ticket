import { z } from 'zod';
import { DEFAULT_SALES_CURRENCY } from './currency.js';

/**
 * What catalog hands to inventory when an event goes on sale.
 * Zod only (no Drizzle), so inventory can import it without the database layer.
 */
export const sellableSeatSchema = z.object({
  seatId: z.string().min(1),
  section: z.string().min(1),
  standing: z.boolean(),
  priceCents: z.number().int().nonnegative(),
  currency: z.literal(DEFAULT_SALES_CURRENCY),
});

export const sellableSeatsSnapshotSchema = z.object({
  eventId: z.uuid(),
  layoutVersion: z.number().int().min(1),
  seats: z.array(sellableSeatSchema),
});

export type SellableSeat = z.infer<typeof sellableSeatSchema>;
export type SellableSeatsSnapshot = z.infer<typeof sellableSeatsSnapshotSchema>;

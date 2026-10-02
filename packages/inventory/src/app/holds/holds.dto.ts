import { z } from 'zod';
import { MAX_SEATS_PER_COMMAND } from './holds.service';

// one or more non-empty parts separated by ':'
// e.g. "x", "x:x", "1:x:x", "a:b:c:d"
const seatId = z
  .string()
  .max(64)
  .regex(/^[^:#\s]+(:[^:#\s]+)*$/, 'expected colon-separated parts');

const seatIds = z
  .array(seatId)
  .min(1)
  .max(MAX_SEATS_PER_COMMAND)
  .refine((ids) => new Set(ids).size === ids.length, 'seatIds must be unique');

export const holdSeatsSchema = z.object({
  holdId: z.uuidv4(),
  seatIds,
});

export const holdStandingSchema = z.object({
  holdId: z.uuidv4(),
  section: z
    .string()
    .max(64)
    .regex(/^[^:#\s]+$/, 'expected a section code'),
  quantity: z.number().int().min(1).max(MAX_SEATS_PER_COMMAND),
});

export const releaseSeatsSchema = z.object({ seatIds });

export const bookSeatsSchema = z.object({
  orderId: z.uuidv7(),
  seatIds,
});

export type HoldSeatsDto = z.infer<typeof holdSeatsSchema>;
export type HoldStandingDto = z.infer<typeof holdStandingSchema>;
export type ReleaseSeatsDto = z.infer<typeof releaseSeatsSchema>;
export type BookSeatsDto = z.infer<typeof bookSeatsSchema>;

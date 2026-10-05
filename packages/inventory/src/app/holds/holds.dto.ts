import { z } from 'zod';
import { MAX_PLACES_PER_HOLD } from './holds.service';

// one or more non-empty parts separated by ':'
// e.g. "x", "x:x", "1:x:x", "a:b:c:d"
const seatId = z
  .string()
  .max(64)
  .regex(/^[^:#\s]+(:[^:#\s]+)*$/, 'expected colon-separated parts');

const seatIds = z
  .array(seatId)
  .min(1)
  .refine((ids) => new Set(ids).size === ids.length, 'seatIds must be unique');

const standing = z
  .array(
    z.strictObject({
      section: z
        .string()
        .max(64)
        .regex(/^[^:#\s]+$/, 'expected a section code'),
      quantity: z.number().int().min(1).max(MAX_PLACES_PER_HOLD),
    }),
  )
  .min(1)
  .refine(
    (items) => new Set(items.map((s) => s.section)).size === items.length,
    'sections must be unique',
  );

export const holdSchema = z
  .strictObject({
    holdId: z.uuidv4(),
    seatIds: seatIds.optional(),
    standing: standing.optional(),
  })
  .refine((hold) => {
    const places =
      (hold.seatIds?.length ?? 0) +
      (hold.standing ?? []).reduce((total, s) => total + s.quantity, 0);

    return places >= 1 && places <= MAX_PLACES_PER_HOLD;
  }, `a hold has 1 to ${MAX_PLACES_PER_HOLD} places`);

export const bookSchema = z.strictObject({
  orderId: z.uuidv7(),
});

export type HoldDto = z.infer<typeof holdSchema>;
export type BookDto = z.infer<typeof bookSchema>;

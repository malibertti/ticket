import { z } from 'zod';

export function isValidSeatIdPart(part: string): boolean {
  const partPattern = /^[^:#\s]+$/;

  return partPattern.test(part);
}

const idPart = z
  .string()
  .refine(isValidSeatIdPart, 'must not contain spaces, ":" or "#"');

const seatedSection = z.object({
  kind: z.literal('seated'),
  code: idPart,
  rows: z
    .array(z.object({ label: idPart, seats: z.number().int().min(1).max(200) }))
    .min(1)
    .refine(
      (rows) => new Set(rows.map((r) => r.label)).size === rows.length,
      'row labels must be unique',
    ),
});

const standingSection = z.object({
  kind: z.literal('standing'),
  code: idPart,
  capacity: z.number().int().min(1).max(100_000),
});

export const venueLayoutSchema = z.object({
  sections: z
    .array(z.discriminatedUnion('kind', [seatedSection, standingSection]))
    .min(1)
    .max(10)
    .refine(
      (s) => new Set(s.map((x) => x.code)).size === s.length,
      'section codes must be unique',
    ),
});

export type VenueLayout = z.infer<typeof venueLayoutSchema>;

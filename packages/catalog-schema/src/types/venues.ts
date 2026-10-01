import { z } from 'zod';

/** Row label used for the unnumbered slots of standing sections: CAMPO:GA:1, CAMPO:GA:2, ... */
export const STANDING_ROW_LABEL = 'GA';

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
export type LayoutSection = VenueLayout['sections'][number];

export interface LayoutSeat {
  seatId: string;
  section: string;
  standing: boolean;
}

export function sectionCodes(layout: VenueLayout): string[] {
  return layout.sections.map((section) => section.code);
}

export function toSeatId(
  section: string,
  rowLabel: string,
  seatNumber: number,
): string {
  const parts = [section, rowLabel, String(seatNumber)];
  const invalid = parts.find((part) => !isValidSeatIdPart(part));

  if (invalid !== undefined) {
    throw new Error(`Invalid seat id part: "${invalid}"`);
  }

  return parts.join(':');
}

/** Every seat of the layout. Standing sections expand to one unnumbered slot per unit of capacity. */
export function expandSeats(layout: VenueLayout): LayoutSeat[] {
  const seats: LayoutSeat[] = [];

  for (const section of layout.sections) {
    if (section.kind === 'standing') {
      for (let n = 1; n <= section.capacity; n++) {
        seats.push({
          seatId: toSeatId(section.code, STANDING_ROW_LABEL, n),
          section: section.code,
          standing: true,
        });
      }
      continue;
    }

    for (const row of section.rows) {
      for (let n = 1; n <= row.seats; n++) {
        seats.push({
          seatId: toSeatId(section.code, row.label, n),
          section: section.code,
          standing: false,
        });
      }
    }
  }

  return seats;
}

/** Sections the layout has but the list lacks, and sections the list has but the layout lacks. */
export function compareSections(
  layoutSections: string[],
  listedSections: string[],
) {
  const layout = new Set(layoutSections);
  const listed = new Set(listedSections);

  return {
    missingSections: layoutSections.filter((section) => !listed.has(section)),
    unknownSections: listedSections.filter((section) => !layout.has(section)),
  };
}

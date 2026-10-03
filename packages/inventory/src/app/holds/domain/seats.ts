import type { Manifest } from '@org/catalog-schema/types';

/**
 * The price of a seated seat, or undefined if the manifest has no such seat.
 * Seat ids look like PLATEA-A:02:7 (section:row:number).
 */
export function seatPrice(
  manifest: Manifest,
  seatId: string,
): number | undefined {
  const [sectionCode, rowLabel, seatNumber, ...rest] = seatId.split(':');

  if (rest.length || !seatNumber) {
    return undefined;
  }

  const section = manifest.layout.sections.find((s) => s.code === sectionCode);

  if (!section || section.kind !== 'seated') {
    return undefined;
  }

  const row = section.rows.find((r) => r.label === rowLabel);
  const number = Number(seatNumber);

  // String(number) === seatNumber rejects "07" for 7: each seat must have exactly one id,
  // otherwise two ids would be two event streams for the same physical seat
  if (
    !row ||
    !Number.isInteger(number) ||
    String(number) !== seatNumber ||
    number < 1 ||
    number > row.seats
  ) {
    return undefined;
  }

  return manifest.prices[section.code];
}

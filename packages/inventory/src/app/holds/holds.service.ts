import { Injectable } from '@nestjs/common';
import { DEFAULT_SALES_CURRENCY, Manifest } from '@org/catalog-schema/types';
import {
  ConcurrencyError,
  CounterChange,
  DbEventStore,
  NotEnoughAvailable,
} from '../db/db.event-store';
import { DbManifest } from '../db/db.manifest';
import {
  SeatCommandRejected,
  SeatError,
  SeatRejection,
  UnknownSeat,
} from './domain/errors';
import { decideHold, evolveHold } from './domain/hold.rules';
import {
  HeldSeat,
  HeldStanding,
  HoldCommand,
  HoldEvent,
  HoldPlaced,
  HoldState,
  initialHoldState,
} from './domain/hold.types';
import { decide, evolve } from './domain/seat.rules';
import {
  initialState,
  SeatCommand,
  SeatEvent,
  SeatState,
} from './domain/seat.types';
import { backoffMs, holdStreamId, seatStreamId, sleep } from './utils';

export const MAX_PLACES_PER_HOLD = 10;

export interface StandingRequest {
  section: string;
  quantity: number;
}

interface Loaded<S> {
  streamId: string;
  version: number;
  state: S;
}

@Injectable()
export class HoldsService {
  private readonly maxAttempts = 3;

  constructor(
    private readonly dbEventStore: DbEventStore,
    private readonly dbManifest: DbManifest,
  ) {}

  /** Holds any mix of seats and standing places, all or nothing. Retrying with the same holdId returns the original hold. */
  async placeHold(
    eventId: string,
    holdId: string,
    seatIds: string[],
    standing: StandingRequest[],
  ) {
    const places =
      seatIds.length + standing.reduce((total, s) => total + s.quantity, 0);

    if (places < 1 || places > MAX_PLACES_PER_HOLD) {
      throw new Error(
        `Expected 1–${MAX_PLACES_PER_HOLD} places, got ${places}`,
      );
    }

    return this.withRetry(async () => {
      const hold = await this.loadHold(eventId, holdId);

      if (hold.state.status !== 'none') {
        return toHoldResponse(hold.state.hold);
      }

      // only what catalog put on sale can be held; current prices are captured in the events
      const manifest = await this.dbManifest.get(eventId);
      const seats: HeldSeat[] = [];
      const heldStanding: HeldStanding[] = [];
      const unknown: string[] = [];
      const counters: CounterChange[] = [];

      for (const seatId of seatIds) {
        const priceCents = manifest && seatPrice(manifest, seatId);
        if (priceCents === undefined) {
          unknown.push(seatId);
        } else {
          seats.push({ seatId, priceCents });
        }
      }

      for (const { section, quantity } of standing) {
        const found = manifest && standingSection(manifest, section);
        if (!found) {
          unknown.push(section);
          continue;
        }
        if (quantity > found.capacity) {
          throw new NotEnoughAvailable([section]);
        }

        heldStanding.push({
          section,
          quantity,
          priceCents: found.priceCents,
        });

        counters.push({
          eventId,
          section,
          delta: quantity,
          capacity: found.capacity,
        });
      }

      if (unknown.length) {
        throw new SeatCommandRejected(
          unknown.map((seatId) => ({ seatId, code: new UnknownSeat().code })),
        );
      }

      const now = new Date();
      const seatDecisions = await this.decideSeats(
        eventId,
        seats.map((s) => s.seatId),
        () => ({
          type: 'HoldSeat',
          holdId,
        }),
        now,
      );

      const holdEvents = decideHold(
        {
          type: 'PlaceHold',
          holdId,
          seats,
          standing: heldStanding,
          currency: DEFAULT_SALES_CURRENCY,
        },
        hold.state,
        now,
      );

      await this.dbEventStore.appendAtomically(
        [...seatDecisions, { ...hold, events: holdEvents }].map(toAppend),
        counters,
      );

      return toHoldResponse(holdEvents[0] as HoldPlaced);
    });
  }

  async releaseHold(eventId: string, holdId: string): Promise<void> {
    await this.applyToHold(eventId, holdId, { type: 'ReleaseHold' }, () => ({
      type: 'ReleaseSeat',
      holdId,
    }));
  }

  async bookHold(
    eventId: string,
    holdId: string,
    orderId: string,
  ): Promise<void> {
    await this.applyToHold(
      eventId,
      holdId,
      { type: 'BookHold', orderId },
      () => ({ type: 'BookSeat', holdId, orderId }),
    );
  }

  /** Decides on the hold and on each of its seats, then appends both, with any counter changes, in one transaction. */
  private async applyToHold(
    eventId: string,
    holdId: string,
    holdCommand: HoldCommand,
    seatCommand: () => SeatCommand,
  ) {
    await this.withRetry(async () => {
      const hold = await this.loadHold(eventId, holdId);
      const now = new Date();
      const holdEvents = decideHold(holdCommand, hold.state, now);

      if (!holdEvents.length || hold.state.status === 'none') {
        return;
      }

      const placed = hold.state.hold;
      const seatDecisions = await this.decideSeats(
        eventId,
        placed.seats.map((s) => s.seatId),
        seatCommand,
        now,
      );

      await this.dbEventStore.appendAtomically(
        [...seatDecisions, { ...hold, events: holdEvents }].map(toAppend),
        countersFor(eventId, placed, holdEvents),
      );
    });
  }

  /** Runs fn, retrying the whole read-decide-write when another writer got there first. */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (!(err instanceof ConcurrencyError) || attempt >= this.maxAttempts) {
          throw err;
        }
        await sleep(backoffMs(attempt));
      }
    }
  }

  private async loadHold(
    eventId: string,
    holdId: string,
  ): Promise<Loaded<HoldState>> {
    const streamId = holdStreamId(eventId, holdId);
    const stored = await this.dbEventStore.readStream<HoldEvent>(streamId);

    return {
      streamId,
      version: stored.at(-1)?.version ?? 0,
      state: stored.map((e) => e.data).reduce(evolveHold, initialHoldState),
    };
  }

  private async loadSeat(
    eventId: string,
    seatId: string,
  ): Promise<Loaded<SeatState> & { seatId: string }> {
    const streamId = seatStreamId(eventId, seatId);
    const stored = await this.dbEventStore.readStream<SeatEvent>(streamId);

    return {
      seatId,
      streamId,
      version: stored.at(-1)?.version ?? 0,
      state: stored.map((e) => e.data).reduce(evolve, initialState),
    };
  }

  /** Loads and decides every seat; rejections are collected so the error names all of them. */
  private async decideSeats(
    eventId: string,
    seatIds: string[],
    commandFor: (seatId: string) => SeatCommand,
    now: Date,
  ) {
    const seats = await Promise.all(
      seatIds.map((seatId) => this.loadSeat(eventId, seatId)),
    );
    const rejections: SeatRejection[] = [];

    const decisions = seats.map((seat) => {
      try {
        return {
          ...seat,
          events: decide(commandFor(seat.seatId), seat.state, now),
        };
      } catch (err) {
        if (!(err instanceof SeatError)) throw err;
        rejections.push({ seatId: seat.seatId, code: err.code });
        return { ...seat, events: [] as SeatEvent[] };
      }
    });

    if (rejections.length) {
      throw new SeatCommandRejected(rejections);
    }

    return decisions;
  }
}

function toAppend(d: {
  streamId: string;
  version: number;
  events: (SeatEvent | HoldEvent)[];
}) {
  return {
    streamId: d.streamId,
    expectedVersion: d.version,
    events: d.events,
  };
}

/** Releasing or expiring returns standing places; booking keeps them sold. */
function countersFor(
  eventId: string,
  placed: HoldPlaced,
  events: HoldEvent[],
): CounterChange[] {
  const returnsPlaces = events.some(
    (e) => e.type === 'HoldReleased' || e.type === 'HoldExpired',
  );

  if (!returnsPlaces) {
    return [];
  }

  return placed.standing.map((s) => ({
    eventId,
    section: s.section,
    delta: -s.quantity,
    capacity: 0, // unused when returning places
  }));
}

function toHoldResponse(hold: HoldPlaced) {
  const seatsTotal = hold.seats.reduce((total, s) => total + s.priceCents, 0);
  const standingTotal = hold.standing.reduce(
    (total, s) => total + s.quantity * s.priceCents,
    0,
  );

  return {
    holdId: hold.holdId,
    expiresAt: hold.expiresAt,
    seats: hold.seats,
    standing: hold.standing,
    totalCents: seatsTotal + standingTotal,
    currency: hold.currency,
  };
}

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

/** A standing section's capacity and price per place, or undefined if it isn't a standing section. */
export function standingSection(
  manifest: Manifest,
  code: string,
): { capacity: number; priceCents: number } | undefined {
  const section = manifest.layout.sections.find((s) => s.code === code);

  if (!section || section.kind !== 'standing') {
    return undefined;
  }

  const priceCents = manifest.prices[section.code];

  return priceCents === undefined
    ? undefined
    : { capacity: section.capacity, priceCents };
}

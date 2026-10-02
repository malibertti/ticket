import { Injectable, Logger } from '@nestjs/common';
import { SellableSeat } from '@org/catalog-schema/types';
import {
  ConcurrencyError,
  EventStoreService,
} from '../event-store/event-store.service';
import { SellableSeatsService } from '../sellable-seats/sellable-seats.service';
import {
  NotEnoughAvailable,
  SeatCommandRejected,
  SeatError,
  SeatRejection,
  UnknownSeat,
} from './seat.errors';
import { decide, evolve } from './seat.rules';
import { initialState, SeatCommand, SeatEvent, SeatState } from './seat.types';

export const MAX_SEATS_PER_COMMAND = 10;

interface LoadedSeat {
  seatId: string;
  streamId: string;
  version: number;
  state: SeatState;
}

@Injectable()
export class SeatsService {
  private readonly logger = new Logger(SeatsService.name);
  private readonly maxAttempts = 3;
  private readonly maxStandingAttempts = 5;

  constructor(
    private readonly eventStore: EventStoreService,
    private readonly sellableSeats: SellableSeatsService,
  ) {}

  async holdSeats(eventId: string, holdId: string, seatIds: string[]) {
    this.assertSeatIds(seatIds);

    // only seats catalog put on sale can be held; their current price is captured in SeatHeld
    const sellable = await this.sellableSeats.findSeats(eventId, seatIds);
    const unknownCode = new UnknownSeat().code;
    const unknown = seatIds.filter((seatId) => !sellable.has(seatId));

    if (unknown.length) {
      throw new SeatCommandRejected(
        unknown.map((seatId) => ({ seatId, code: unknownCode })),
      );
    }

    return this.holdSellable(eventId, holdId, seatIds, sellable);
  }

  /**
   * Holds `quantity` unnumbered slots of a standing section; inventory picks which.
   * Not idempotent: retrying with the same holdId picks new slots (the extras expire with the hold).
   */
  async holdStanding(
    eventId: string,
    holdId: string,
    section: string,
    quantity: number,
  ) {
    const slots = (
      await this.sellableSeats.findSection(eventId, section)
    ).filter((seat) => seat.standing);

    if (!slots.length) {
      throw new SeatCommandRejected([
        { seatId: section, code: new UnknownSeat().code },
      ]);
    }

    const sellable = new Map(slots.map((slot) => [slot.seatId, slot]));
    const remaining = shuffle(slots.map((slot) => slot.seatId));
    let picked = remaining.splice(0, quantity);

    for (let attempt = 1; ; attempt++) {
      if (picked.length < quantity) {
        throw new NotEnoughAvailable(section, quantity);
      }

      try {
        return await this.holdSellable(eventId, holdId, picked, sellable);
      } catch (err) {
        if (!(err instanceof SeatCommandRejected)) throw err;
        if (attempt >= this.maxStandingAttempts) {
          throw new NotEnoughAvailable(section, quantity);
        }

        // swap the taken slots for untried ones and go again
        const taken = new Set(err.rejections.map((r) => r.seatId));
        picked = picked.filter((seatId) => !taken.has(seatId));
        picked.push(...remaining.splice(0, quantity - picked.length));
      }
    }
  }

  private async holdSellable(
    eventId: string,
    holdId: string,
    seatIds: string[],
    sellable: Map<string, SellableSeat>,
  ) {
    const states = await this.execute(eventId, seatIds, (seatId) => {
      const seat = sellable.get(seatId)!;

      return {
        type: 'HoldSeat',
        holdId,
        priceCents: seat.priceCents,
        currency: seat.currency,
      };
    });

    // read from the resulting state: on an idempotent retry no SeatHeld is emitted,
    // and the price that counts is the one captured by the original hold
    const seats = states.map((state, i) => {
      if (state.status !== 'held') {
        throw new Error(`Seat ${seatIds[i]} not held after HoldSeat`);
      }

      return {
        seatId: seatIds[i],
        expiresAt: state.expiresAt,
        priceCents: state.priceCents,
        currency: state.currency,
      };
    });

    const expiresAt = new Date(
      Math.min(...seats.map((s) => s.expiresAt.getTime())),
    );

    return {
      holdId,
      expiresAt: expiresAt.toISOString(),
      seats: seats.map(({ seatId, priceCents, currency }) => ({
        seatId,
        priceCents,
        currency,
      })),
      totalCents: seats.reduce((total, s) => total + s.priceCents, 0),
      currency: seats[0].currency,
    };
  }

  async releaseSeats(
    eventId: string,
    holdId: string,
    seatIds: string[],
  ): Promise<void> {
    await this.execute(eventId, seatIds, () => {
      return {
        type: 'ReleaseSeat',
        holdId,
      };
    });
  }

  async bookSeats(
    eventId: string,
    holdId: string,
    orderId: string,
    seatIds: string[],
  ): Promise<void> {
    await this.execute(eventId, seatIds, () => {
      return {
        type: 'BookSeat',
        holdId,
        orderId,
      };
    });
  }

  /** Load → decide → append for every seat, all or nothing. Retries on concurrent writes. */
  private async execute(
    eventId: string,
    seatIds: string[],
    commandFor: (seatId: string) => SeatCommand,
  ): Promise<SeatState[]> {
    this.logger.debug({ eventId, seatIds }, 'execute');
    this.assertSeatIds(seatIds);

    for (let attempt = 1; ; attempt++) {
      const seats = await Promise.all(
        seatIds.map((seatId) => this.load(eventId, seatId)),
      );
      const decisions = this.decideAll(seats, commandFor, new Date());

      try {
        await this.eventStore.appendAtomically(
          decisions.map((d) => ({
            streamId: d.streamId,
            expectedVersion: d.version,
            events: d.events,
          })),
        );
        return decisions.map((d) => d.events.reduce(evolve, d.state));
      } catch (err) {
        if (!(err instanceof ConcurrencyError) || attempt >= this.maxAttempts)
          throw err;
        await sleep(backoffMs(attempt));
      }
    }
  }

  private async load(eventId: string, seatId: string): Promise<LoadedSeat> {
    this.logger.debug({ eventId, seatId }, 'load');
    const streamId = seatStreamId(eventId, seatId);
    const stored = await this.eventStore.readStream<SeatEvent>(streamId);

    return {
      seatId,
      streamId,
      version: stored.at(-1)?.version ?? 0,
      state: stored.map((e) => e.data).reduce(evolve, initialState),
    };
  }

  private decideAll(
    seats: LoadedSeat[],
    commandFor: (seatId: string) => SeatCommand,
    now: Date,
  ) {
    this.logger.debug({ seats }, 'decideAll');
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

    if (rejections.length) throw new SeatCommandRejected(rejections);
    return decisions;
  }

  private assertSeatIds(seatIds: string[]) {
    if (seatIds.length === 0 || seatIds.length > MAX_SEATS_PER_COMMAND) {
      throw new Error(
        `Expected 1–${MAX_SEATS_PER_COMMAND} seats, got ${seatIds.length}`,
      );
    }
    if (new Set(seatIds).size !== seatIds.length) {
      throw new Error('Duplicate seatIds');
    }
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const backoffMs = (attempt: number) =>
  50 * 2 ** (attempt - 1) + Math.random() * 50; // ~50, ~100, jittered

export function seatStreamId(eventId: string, seatId: string): string {
  const sep = '#';

  if (eventId.includes(sep) || seatId.includes(sep)) {
    throw new Error(`Ids must not contain "${sep}": ${eventId}, ${seatId}`);
  }

  return `seat${sep}${eventId}${sep}${seatId}`;
}

/** Fisher–Yates: spreads concurrent buyers across the section so they rarely compete for the same slots. */
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

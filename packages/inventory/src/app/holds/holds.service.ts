import { Injectable, Logger } from '@nestjs/common';
import { DEFAULT_SALES_CURRENCY } from '@org/catalog-schema/types';
import { ConcurrencyError, DbEventStore } from '../db/db.event-store';
import { DbManifest } from '../db/db.manifest';
import {
  SeatCommandRejected,
  SeatError,
  SeatRejection,
  UnknownSeat,
} from './domain/errors';
import { decide, evolve } from './domain/rules';
import { seatPrice } from './domain/seats';
import {
  initialState,
  SeatCommand,
  SeatEvent,
  SeatState,
} from './domain/types';

export const MAX_SEATS_PER_COMMAND = 10;

interface LoadedSeat {
  seatId: string;
  streamId: string;
  version: number;
  state: SeatState;
}

@Injectable()
export class HoldsService {
  private readonly logger = new Logger(HoldsService.name);
  private readonly maxAttempts = 3;

  constructor(
    private readonly dbEventStore: DbEventStore,
    private readonly dbManifest: DbManifest,
  ) {}

  async holdSeats(eventId: string, holdId: string, seatIds: string[]) {
    this.assertSeatIds(seatIds);

    // only seats catalog put on sale can be held; their current price is captured in SeatHeld
    const manifest = await this.dbManifest.get(eventId);
    const prices = new Map<string, number>();

    for (const seatId of seatIds) {
      const price = manifest && seatPrice(manifest, seatId);
      if (price !== undefined) prices.set(seatId, price);
    }

    const unknown = seatIds.filter((seatId) => !prices.has(seatId));

    if (unknown.length) {
      throw new SeatCommandRejected(
        unknown.map((seatId) => ({
          seatId,
          code: new UnknownSeat().code,
        })),
      );
    }

    return this.holdSellable(eventId, holdId, seatIds, prices);
  }

  private async holdSellable(
    eventId: string,
    holdId: string,
    seatIds: string[],
    prices: Map<string, number>,
  ) {
    const states = await this.execute(eventId, seatIds, (seatId) => {
      return {
        type: 'HoldSeat',
        holdId,
        priceCents: prices.get(seatId)!,
        currency: DEFAULT_SALES_CURRENCY,
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
        await this.dbEventStore.appendAtomically(
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
    const stored = await this.dbEventStore.readStream<SeatEvent>(streamId);
    const version = stored.at(-1)?.version ?? 0;
    const state = stored.map((e) => e.data).reduce(evolve, initialState);

    return {
      seatId,
      streamId,
      version,
      state,
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
        if (!(err instanceof SeatError)) {
          throw err;
        }

        rejections.push({
          seatId: seat.seatId,
          code: err.code,
        });

        return {
          ...seat,
          events: [] as SeatEvent[],
        };
      }
    });

    if (rejections.length) {
      throw new SeatCommandRejected(rejections);
    }

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

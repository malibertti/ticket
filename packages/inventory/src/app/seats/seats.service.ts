import { Injectable, Logger } from '@nestjs/common';
import {
  ConcurrencyError,
  EventStoreService,
} from '../event-store/event-store.service';
import { SeatCommandRejected, SeatError, SeatRejection } from './seat.errors';
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

  constructor(private readonly eventStore: EventStoreService) {}

  async holdSeats(
    eventId: string,
    holdId: string,
    seatIds: string[],
  ): Promise<{ holdId: string; expiresAt: string }> {
    const states = await this.execute(eventId, seatIds, {
      type: 'HoldSeat',
      holdId,
    });

    // on an idempotent retry no SeatHeld is emitted, so read expiresAt from the resulting state
    const expiresAt = Math.min(
      ...states.map((s) =>
        s.status === 'held' ? s.expiresAt.getTime() : Infinity,
      ),
    );
    return { holdId, expiresAt: new Date(expiresAt).toISOString() };
  }

  async releaseSeats(
    eventId: string,
    holdId: string,
    seatIds: string[],
  ): Promise<void> {
    await this.execute(eventId, seatIds, { type: 'ReleaseSeat', holdId });
  }

  async bookSeats(
    eventId: string,
    holdId: string,
    orderId: string,
    seatIds: string[],
  ): Promise<void> {
    await this.execute(eventId, seatIds, { type: 'BookSeat', holdId, orderId });
  }

  /** Load → decide → append for every seat, all or nothing. Retries on concurrent writes. */
  private async execute(
    eventId: string,
    seatIds: string[],
    cmd: SeatCommand,
  ): Promise<SeatState[]> {
    this.logger.debug({ eventId, seatIds, cmd }, 'execute');
    this.assertSeatIds(seatIds);

    for (let attempt = 1; ; attempt++) {
      const seats = await Promise.all(
        seatIds.map((seatId) => this.load(eventId, seatId)),
      );
      const decisions = this.decideAll(seats, cmd, new Date());

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

  private decideAll(seats: LoadedSeat[], cmd: SeatCommand, now: Date) {
    this.logger.debug({ seats, cmd }, 'decideAll');
    const rejections: SeatRejection[] = [];
    const decisions = seats.map((seat) => {
      try {
        return { ...seat, events: decide(cmd, seat.state, now) };
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

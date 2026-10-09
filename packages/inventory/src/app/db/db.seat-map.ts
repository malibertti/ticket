import { Injectable } from '@nestjs/common';
import { Valkey } from 'iovalkey';

type SeatStatus = 'held' | 'booked';

/**
 * The seat map read model: one Valkey hash per event, seatId → "booked" or the hold's expiresAt.
 * A seat that isn't in the hash is available. Built from inventory.events.v1 by SeatMapConsumer.
 */
@Injectable()
export class DbSeatMap {
  constructor(private readonly valkey: Valkey) {}

  held(eventId: string, seatId: string, expiresAt: string): Promise<number> {
    return this.valkey.hset(key(eventId), seatId, expiresAt);
  }

  booked(eventId: string, seatId: string): Promise<number> {
    return this.valkey.hset(key(eventId), seatId, 'booked');
  }

  available(eventId: string, seatId: string): Promise<number> {
    return this.valkey.hdel(key(eventId), seatId);
  }

  /**
   * Taken seats only. A hold past its expiresAt counts as available even before its
   * SeatExpired arrives, the same rule the seat aggregate uses.
   */
  async get(eventId: string, now: Date): Promise<Record<string, SeatStatus>> {
    const entries = await this.valkey.hgetall(key(eventId));
    const seats: Record<string, SeatStatus> = {};

    for (const [seatId, value] of Object.entries(entries)) {
      if (value === 'booked') {
        seats[seatId] = 'booked';
      } else if (new Date(value) > now) {
        seats[seatId] = 'held';
      }
    }

    return seats;
  }
}

function key(eventId: string): string {
  return `seatmap:v1:${eventId}`;
}

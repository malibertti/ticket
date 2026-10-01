import {
  HoldExpiredError,
  NotHeld,
  SeatAlreadyBooked,
  SeatAlreadyHeld,
  WrongHoldId,
} from './seat.errors';
import { SeatCommand, SeatEvent, SeatState } from './seat.types';

export const HOLD_DURATION_MS = 10 * 60_000;

function isExpired(state: { expiresAt: Date }, now: Date) {
  return state.expiresAt <= now;
}

function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}

export function decide(
  cmd: SeatCommand,
  state: SeatState,
  now: Date,
): SeatEvent[] {
  switch (cmd.type) {
    case 'HoldSeat': {
      const events: SeatEvent[] = [];

      if (state.status === 'booked') {
        throw new SeatAlreadyBooked();
      }

      if (state.status === 'held') {
        if (!isExpired(state, now)) {
          if (state.holdId === cmd.holdId) {
            return [];
          }

          throw new SeatAlreadyHeld();
        }

        events.push({
          type: 'HoldExpired',
          holdId: state.holdId,
        });
      }

      events.push({
        type: 'SeatHeld',
        holdId: cmd.holdId,
        expiresAt: new Date(now.getTime() + HOLD_DURATION_MS).toISOString(),
      });

      return events;
    }

    case 'ReleaseSeat': {
      if (state.status === 'booked') {
        throw new SeatAlreadyBooked();
      }

      // Nothing to release
      if (state.status === 'available') {
        return [];
      }

      // Someone else's hold
      if (state.holdId !== cmd.holdId) {
        return [];
      }

      // Your hold, but it already lapsed: record the truth
      if (isExpired(state, now)) {
        return [
          {
            type: 'HoldExpired',
            holdId: state.holdId,
          },
        ];
      }

      return [
        {
          type: 'SeatReleased',
          holdId: state.holdId,
        },
      ];
    }

    case 'BookSeat': {
      if (state.status === 'booked') {
        // Same hold, same order: a retry, so it's a no-op
        if (state.holdId === cmd.holdId && state.orderId === cmd.orderId) {
          return [];
        }

        throw new SeatAlreadyBooked();
      }

      if (state.status === 'available') {
        throw new NotHeld();
      }

      if (state.holdId !== cmd.holdId) {
        throw new WrongHoldId();
      }

      if (isExpired(state, now)) {
        throw new HoldExpiredError();
      }

      return [
        {
          type: 'SeatBooked',
          holdId: state.holdId,
          orderId: cmd.orderId,
        },
      ];
    }

    case 'ExpireHold': {
      const events: SeatEvent[] = [];

      if (
        state.status === 'held' &&
        cmd.holdId === state.holdId &&
        isExpired(state, now)
      ) {
        events.push({
          type: 'HoldExpired',
          holdId: state.holdId,
        });
      }

      return events;
    }

    default:
      return assertNever(cmd);
  }
}

export function evolve(state: SeatState, event: SeatEvent): SeatState {
  switch (event.type) {
    case 'SeatHeld':
      return {
        status: 'held',
        holdId: event.holdId,
        expiresAt: new Date(event.expiresAt),
      };

    case 'HoldExpired':
    case 'SeatReleased':
      return {
        status: 'available',
      };

    case 'SeatBooked':
      return {
        status: 'booked',
        holdId: event.holdId,
        orderId: event.orderId,
      };

    default:
      return assertNever(event);
  }
}

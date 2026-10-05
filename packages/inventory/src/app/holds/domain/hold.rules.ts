import { HoldError } from './errors';
import { HoldCommand, HoldEvent, HoldState } from './hold.types';
import { HOLD_DURATION_MS } from './seat.rules';
import { assertNever, isExpired } from './utils';

export function decideHold(
  cmd: HoldCommand,
  state: HoldState,
  now: Date,
): HoldEvent[] {
  switch (cmd.type) {
    case 'PlaceHold': {
      // a retry of a hold that already exists: nothing new to record
      if (state.status !== 'none') {
        return [];
      }

      return [
        {
          type: 'HoldPlaced',
          holdId: cmd.holdId,
          seats: cmd.seats,
          standing: cmd.standing,
          currency: cmd.currency,
          expiresAt: new Date(now.getTime() + HOLD_DURATION_MS).toISOString(),
        },
      ];
    }

    case 'ReleaseHold': {
      if (state.status === 'none') {
        throw new HoldError('HOLD_NOT_FOUND');
      }

      if (state.status === 'booked') {
        throw new HoldError('HOLD_ALREADY_BOOKED');
      }

      // already released or expired: a retry
      if (state.status !== 'placed') {
        return [];
      }

      // releasing a lapsed hold records the truth: it expired
      if (isExpired(state.hold, now)) {
        return [{ type: 'HoldExpired', holdId: state.hold.holdId }];
      }

      return [{ type: 'HoldReleased', holdId: state.hold.holdId }];
    }

    case 'BookHold': {
      if (state.status === 'none') {
        throw new HoldError('HOLD_NOT_FOUND');
      }

      if (state.status === 'booked') {
        // same order: a retry
        if (state.orderId === cmd.orderId) {
          return [];
        }

        throw new HoldError('HOLD_ALREADY_BOOKED');
      }

      if (state.status !== 'placed') {
        throw new HoldError('HOLD_NOT_ACTIVE');
      }

      if (isExpired(state.hold, now)) {
        throw new HoldError('HOLD_EXPIRED');
      }

      return [
        { type: 'HoldBooked', holdId: state.hold.holdId, orderId: cmd.orderId },
      ];
    }

    case 'ExpireHold': {
      if (state.status === 'placed' && isExpired(state.hold, now)) {
        return [{ type: 'HoldExpired', holdId: state.hold.holdId }];
      }

      return [];
    }

    default:
      return assertNever(cmd);
  }
}

export function evolveHold(state: HoldState, event: HoldEvent): HoldState {
  switch (event.type) {
    case 'HoldPlaced':
      return { status: 'placed', hold: event };

    case 'HoldReleased':
      return state.status === 'none'
        ? state
        : { status: 'released', hold: state.hold };

    case 'HoldExpired':
      return state.status === 'none'
        ? state
        : { status: 'expired', hold: state.hold };

    case 'HoldBooked':
      return state.status === 'none'
        ? state
        : { status: 'booked', hold: state.hold, orderId: event.orderId };

    default:
      return assertNever(event);
  }
}

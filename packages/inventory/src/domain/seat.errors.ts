export abstract class SeatError extends Error {
  abstract readonly code: string;
}

export class SeatAlreadyHeld extends SeatError {
  readonly code = 'SEAT_ALREADY_HELD';
}

export class SeatAlreadyBooked extends SeatError {
  readonly code = 'SEAT_ALREADY_BOOKED';
}

export class HoldExpiredError extends SeatError {
  readonly code = 'HOLD_EXPIRED_ERROR';
}

export class WrongHoldId extends SeatError {
  readonly code = 'WRONG_HOLD_ID';
}

export class NotHeld extends SeatError {
  readonly code = 'NOT_HELD';
}

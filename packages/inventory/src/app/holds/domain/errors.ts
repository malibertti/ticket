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

export class UnknownSeat extends SeatError {
  readonly code = 'UNKNOWN_SEAT';
}

export interface SeatRejection {
  seatId: string;
  code: string;
}

export class SeatCommandRejected extends Error {
  constructor(readonly rejections: SeatRejection[]) {
    super(
      `Rejected: ${rejections.map((r) => `${r.seatId} (${r.code})`).join(', ')}`,
    );
    this.name = 'SeatCommandRejected';
  }
}

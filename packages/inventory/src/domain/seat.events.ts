export type SeatHeld = {
  type: 'SeatHeld';
  holdId: string;
  expiresAt: string;
};

export type HoldExpired = {
  type: 'HoldExpired';
  holdId: string;
};

export type SeatReleased = {
  type: 'SeatReleased';
  holdId: string;
};

export type SeatBooked = {
  type: 'SeatBooked';
  holdId: string;
  orderId: string;
};

export type SeatEvent = SeatHeld | HoldExpired | SeatReleased | SeatBooked;

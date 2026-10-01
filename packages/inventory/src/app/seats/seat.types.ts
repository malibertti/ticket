export type SeatCommand =
  | {
      type: 'HoldSeat';
      holdId: string;
    }
  | {
      type: 'ReleaseSeat';
      holdId: string;
    }
  | {
      type: 'BookSeat';
      holdId: string;
      orderId: string;
    }
  | {
      type: 'ExpireHold';
      holdId: string;
    };

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

export type SeatState =
  | {
      status: 'available';
    }
  | {
      status: 'held';
      holdId: string;
      expiresAt: Date;
    }
  | {
      status: 'booked';
      holdId: string;
      orderId: string;
    };

export const initialState: SeatState = {
  status: 'available',
};

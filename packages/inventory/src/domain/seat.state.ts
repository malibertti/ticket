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

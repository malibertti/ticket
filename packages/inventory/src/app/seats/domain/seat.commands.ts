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

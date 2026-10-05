// ---------- hold stream: one per hold, recording what it holds ----------

import { SalesCurrency } from '@org/catalog-schema/types';

export interface HeldSeat {
  seatId: string;
  priceCents: number;
}

export interface HeldStanding {
  section: string;
  quantity: number;
  priceCents: number; // per place
}

export type HoldCommand =
  | {
      type: 'PlaceHold';
      holdId: string;
      seats: HeldSeat[];
      standing: HeldStanding[];
      currency: SalesCurrency;
    }
  | {
      type: 'ReleaseHold';
    }
  | {
      type: 'BookHold';
      orderId: string;
    }
  | {
      type: 'ExpireHold';
    };

export type HoldPlaced = {
  type: 'HoldPlaced';
  holdId: string;
  seats: HeldSeat[];
  standing: HeldStanding[];
  currency: SalesCurrency;
  expiresAt: string;
};

export type HoldReleased = {
  type: 'HoldReleased';
  holdId: string;
};

export type HoldExpired = {
  type: 'HoldExpired';
  holdId: string;
};

export type HoldBooked = {
  type: 'HoldBooked';
  holdId: string;
  orderId: string;
};

export type HoldEvent = HoldPlaced | HoldReleased | HoldExpired | HoldBooked;

export type HoldState =
  | {
      status: 'none';
    }
  | {
      status: 'placed' | 'released' | 'expired';
      hold: HoldPlaced;
    }
  | {
      status: 'booked';
      hold: HoldPlaced;
      orderId: string;
    };

export const initialHoldState: HoldState = {
  status: 'none',
};

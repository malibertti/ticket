import {
  HoldExpiredError,
  NotHeld,
  SeatAlreadyBooked,
  SeatAlreadyHeld,
  WrongHoldId,
} from './errors';
import { decide, evolve, HOLD_DURATION_MS } from './rules';
import { initialState, SeatCommand, SeatEvent, SeatState } from './types';

// ---------- helpers ----------

const T0 = new Date('2026-10-01T10:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);
const EXPIRY = at(HOLD_DURATION_MS); // when a hold taken at T0 lapses
const BEFORE_EXPIRY = at(HOLD_DURATION_MS - 1);
const AFTER_EXPIRY = at(HOLD_DURATION_MS + 60_000);
const price = {
  priceCents: 12_000,
  currency: 'USD' as const,
};

const heldAt = (holdId: string, time = T0): SeatEvent => ({
  type: 'SeatHeld',
  holdId,
  expiresAt: new Date(time.getTime() + HOLD_DURATION_MS).toISOString(),
  ...price,
});

const fold = (events: SeatEvent[]): SeatState =>
  events.reduce(evolve, initialState);

const given = (...past: SeatEvent[]) => ({
  when: (cmd: SeatCommand, now: Date) => decide(cmd, fold(past), now),
});

// ---------- HoldSeat ----------

describe('HoldSeat', () => {
  const hold = (holdId: string): SeatCommand => ({
    type: 'HoldSeat',
    holdId,
    ...price,
  });

  it('holds an available seat for HOLD_DURATION_MS', () => {
    expect(given().when(hold('h1'), T0)).toEqual([heldAt('h1', T0)]);
  });

  it('is a no-op when retried with the same holdId while the hold is valid', () => {
    expect(given(heldAt('h1')).when(hold('h1'), BEFORE_EXPIRY)).toEqual([]);
  });

  it('rejects a different holdId while the hold is valid', () => {
    expect(() => given(heldAt('h1')).when(hold('h2'), BEFORE_EXPIRY)).toThrow(
      SeatAlreadyHeld,
    );
  });

  it('takes over a lapsed hold from someone else, recording the expiry first', () => {
    expect(given(heldAt('h1')).when(hold('h2'), AFTER_EXPIRY)).toEqual([
      { type: 'HoldExpired', holdId: 'h1' },
      heldAt('h2', AFTER_EXPIRY),
    ]);
  });

  it('re-holds with the same holdId after its own hold lapsed (deliberate: holdId reuse)', () => {
    expect(given(heldAt('h1')).when(hold('h1'), AFTER_EXPIRY)).toEqual([
      { type: 'HoldExpired', holdId: 'h1' },
      heldAt('h1', AFTER_EXPIRY),
    ]);
  });

  it('treats a hold as lapsed exactly at expiresAt', () => {
    expect(given(heldAt('h1')).when(hold('h2'), EXPIRY)).toEqual([
      { type: 'HoldExpired', holdId: 'h1' },
      heldAt('h2', EXPIRY),
    ]);
  });

  it('holds a seat again after it was released', () => {
    const past = [
      heldAt('h1'),
      { type: 'SeatReleased', holdId: 'h1' } as SeatEvent,
    ];
    expect(given(...past).when(hold('h2'), at(1000))).toEqual([
      heldAt('h2', at(1000)),
    ]);
  });

  it('rejects a booked seat', () => {
    const past = [
      heldAt('h1'),
      { type: 'SeatBooked', holdId: 'h1', orderId: 'o1' } as SeatEvent,
    ];
    expect(() => given(...past).when(hold('h2'), AFTER_EXPIRY)).toThrow(
      SeatAlreadyBooked,
    );
  });
});

// ---------- ReleaseSeat ----------

describe('ReleaseSeat', () => {
  const release = (holdId: string): SeatCommand => ({
    type: 'ReleaseSeat',
    holdId,
  });

  it('releases your own valid hold', () => {
    expect(given(heldAt('h1')).when(release('h1'), BEFORE_EXPIRY)).toEqual([
      { type: 'SeatReleased', holdId: 'h1' },
    ]);
  });

  it('records HoldExpired when your hold already lapsed', () => {
    expect(given(heldAt('h1')).when(release('h1'), AFTER_EXPIRY)).toEqual([
      { type: 'HoldExpired', holdId: 'h1' },
    ]);
  });

  it('is a no-op on an available seat (retry after success)', () => {
    expect(given().when(release('h1'), T0)).toEqual([]);
  });

  it("is a no-op on someone else's hold (retry after the seat was re-held)", () => {
    expect(given(heldAt('h2')).when(release('h1'), BEFORE_EXPIRY)).toEqual([]);
  });

  it('rejects a booked seat', () => {
    const past = [
      heldAt('h1'),
      { type: 'SeatBooked', holdId: 'h1', orderId: 'o1' } as SeatEvent,
    ];
    expect(() => given(...past).when(release('h1'), BEFORE_EXPIRY)).toThrow(
      SeatAlreadyBooked,
    );
  });
});

// ---------- BookSeat ----------

describe('BookSeat', () => {
  const book = (holdId: string, orderId = 'o1'): SeatCommand => ({
    type: 'BookSeat',
    holdId,
    orderId,
  });

  it('books with a valid hold', () => {
    expect(given(heldAt('h1')).when(book('h1'), at(1000))).toEqual([
      { type: 'SeatBooked', holdId: 'h1', orderId: 'o1' },
    ]);
  });

  it('books 1 ms before expiresAt', () => {
    expect(given(heldAt('h1')).when(book('h1'), BEFORE_EXPIRY)).toHaveLength(1);
  });

  it('rejects exactly at expiresAt', () => {
    expect(() => given(heldAt('h1')).when(book('h1'), EXPIRY)).toThrow(
      HoldExpiredError,
    );
  });

  it('rejects a lapsed but unswept hold', () => {
    expect(() => given(heldAt('h1')).when(book('h1'), AFTER_EXPIRY)).toThrow(
      HoldExpiredError,
    );
  });

  it('rejects an available seat', () => {
    expect(() => given().when(book('h1'), T0)).toThrow(NotHeld);
  });

  it("rejects someone else's hold", () => {
    expect(() => given(heldAt('h2')).when(book('h1'), BEFORE_EXPIRY)).toThrow(
      WrongHoldId,
    );
  });

  describe('when already booked', () => {
    const past = [
      heldAt('h1'),
      { type: 'SeatBooked', holdId: 'h1', orderId: 'o1' } as SeatEvent,
    ];

    it('is a no-op for the exact same hold and order (retry)', () => {
      expect(given(...past).when(book('h1', 'o1'), AFTER_EXPIRY)).toEqual([]);
    });

    it('rejects the same hold with a different order', () => {
      expect(() =>
        given(...past).when(book('h1', 'o2'), BEFORE_EXPIRY),
      ).toThrow(SeatAlreadyBooked);
    });

    it('rejects a different hold', () => {
      expect(() =>
        given(...past).when(book('h2', 'o1'), BEFORE_EXPIRY),
      ).toThrow(SeatAlreadyBooked);
    });
  });
});

// ---------- ExpireHold ----------

describe('ExpireHold', () => {
  const expire = (holdId: string): SeatCommand => ({
    type: 'ExpireHold',
    holdId,
  });

  it('expires the matching lapsed hold', () => {
    expect(given(heldAt('h1')).when(expire('h1'), EXPIRY)).toEqual([
      { type: 'HoldExpired', holdId: 'h1' },
    ]);
  });

  it.each<[string, SeatEvent[], string, Date]>([
    [
      'the hold is still valid (sweeper ran early)',
      [heldAt('h1')],
      'h1',
      BEFORE_EXPIRY,
    ],
    [
      'the holdId does not match (stale job)',
      [heldAt('h2')],
      'h1',
      AFTER_EXPIRY,
    ],
    [
      'the seat is available (already expired or released)',
      [],
      'h1',
      AFTER_EXPIRY,
    ],
    [
      'the seat is booked',
      [heldAt('h1'), { type: 'SeatBooked', holdId: 'h1', orderId: 'o1' }],
      'h1',
      AFTER_EXPIRY,
    ],
  ])('is a no-op when %s', (_, past, holdId, now) => {
    expect(given(...past).when(expire(holdId), now)).toEqual([]);
  });

  it('cannot cancel a re-hold that reused the same holdId', () => {
    const past = [
      heldAt('h1'),
      { type: 'HoldExpired', holdId: 'h1' } as SeatEvent,
      heldAt('h1', AFTER_EXPIRY),
    ];
    // the old sweeper job for the first hold fires late, but the new hold is still valid
    expect(
      given(...past).when(expire('h1'), at(HOLD_DURATION_MS + 120_000)),
    ).toEqual([]);
  });
});

describe('price capture', () => {
  it('records the price from the command in SeatHeld', () => {
    const [held] = given().when(
      { type: 'HoldSeat', holdId: 'h1', priceCents: 99_00, currency: 'USD' },
      T0,
    );
    expect(held).toMatchObject({ type: 'SeatHeld', priceCents: 99_00 });
  });

  it('keeps the captured price when retried with a new price', () => {
    // idempotent retry: no new SeatHeld, so the original price stands
    expect(
      given(heldAt('h1')).when(
        { type: 'HoldSeat', holdId: 'h1', priceCents: 1, currency: 'USD' },
        BEFORE_EXPIRY,
      ),
    ).toEqual([]);
  });
});

// ---------- evolve ----------

describe('evolve', () => {
  it('starts available', () => {
    expect(fold([])).toEqual({ status: 'available' });
  });

  it('parses expiresAt into a Date', () => {
    expect(fold([heldAt('h1')])).toEqual({
      status: 'held',
      holdId: 'h1',
      expiresAt: EXPIRY,
      ...price,
    });
  });

  it('replays a full lifecycle', () => {
    expect(
      fold([
        heldAt('h1'),
        { type: 'HoldExpired', holdId: 'h1' },
        heldAt('h2', AFTER_EXPIRY),
        { type: 'SeatReleased', holdId: 'h2' },
        heldAt('h3', AFTER_EXPIRY),
        { type: 'SeatBooked', holdId: 'h3', orderId: 'o1' },
      ]),
    ).toEqual({ status: 'booked', holdId: 'h3', orderId: 'o1' });
  });
});

import { Clock } from '../../common/clock';
import { ConcurrencyError } from '../../event-store/event-store.port';
import { InMemoryEventStore } from '../../event-store/in-memory-event-store';
import { HOLD_DURATION_MS } from '../domain/seat.decider';
import { HoldExpiredError, SeatAlreadyHeld } from '../domain/seat.errors';
import { SeatEvent } from '../domain/seat.events';
import { seatStreamId } from '../seat-stream-id';
import {
  SeatCommandRejected,
  SeatRejection,
} from './seat-command-rejected.error';
import { SeatCommandsService } from './seat-commands.service';

// ---------- helpers ----------

const EVENT = 'evt_1';
const T0 = new Date('2026-10-01T10:00:00.000Z');
const EXPIRY_ISO = new Date(T0.getTime() + HOLD_DURATION_MS).toISOString();

class FakeClock implements Clock {
  constructor(private current: Date) {}
  now() {
    return new Date(this.current);
  }
  set(date: Date) {
    this.current = date;
  }
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }
}

let store: InMemoryEventStore;
let clock: FakeClock;
let service: SeatCommandsService;

beforeEach(() => {
  store = new InMemoryEventStore();
  clock = new FakeClock(T0);
  service = new SeatCommandsService(store, clock);
});

const eventsOf = async (seatId: string): Promise<SeatEvent[]> =>
  (await store.readStream<SeatEvent>(seatStreamId(EVENT, seatId))).map(
    (e) => e.data,
  );

async function rejectionsOf(
  promise: Promise<unknown>,
): Promise<SeatRejection[]> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof SeatCommandRejected) return err.rejections;
    throw err;
  }
  throw new Error('Expected SeatCommandRejected, but the command succeeded');
}

const heldEvent = (holdId: string, expiresAt = EXPIRY_ISO): SeatEvent => ({
  type: 'SeatHeld',
  holdId,
  expiresAt,
});

// ---------- holdSeats ----------

describe('holdSeats', () => {
  it('holds every seat and returns the deadline', async () => {
    const result = await service.holdSeats(EVENT, 'h1', ['A-1', 'A-2']);

    expect(result).toEqual({ holdId: 'h1', expiresAt: EXPIRY_ISO });
    expect(await eventsOf('A-1')).toEqual([heldEvent('h1')]);
    expect(await eventsOf('A-2')).toEqual([heldEvent('h1')]);
  });

  it('returns the original deadline on a retry, without writing again', async () => {
    await service.holdSeats(EVENT, 'h1', ['A-1']);
    clock.advance(60_000);

    const retry = await service.holdSeats(EVENT, 'h1', ['A-1']);

    expect(retry.expiresAt).toBe(EXPIRY_ISO);
    expect(await eventsOf('A-1')).toHaveLength(1);
  });

  it('rejects all seats when any is taken, naming every taken seat', async () => {
    await service.holdSeats(EVENT, 'h0', ['A-2', 'A-3']);

    const rejections = await rejectionsOf(
      service.holdSeats(EVENT, 'h1', ['A-1', 'A-2', 'A-3']),
    );

    const code = new SeatAlreadyHeld().code;
    expect(rejections).toEqual([
      { seatId: 'A-2', code },
      { seatId: 'A-3', code },
    ]);
    expect(await eventsOf('A-1')).toEqual([]); // the free seat was not held either
  });

  it('takes over lapsed holds', async () => {
    await service.holdSeats(EVENT, 'h0', ['A-1']);
    clock.advance(HOLD_DURATION_MS);

    await service.holdSeats(EVENT, 'h1', ['A-1']);

    expect(await eventsOf('A-1')).toEqual([
      heldEvent('h0'),
      { type: 'HoldExpired', holdId: 'h0' },
      heldEvent(
        'h1',
        new Date(T0.getTime() + 2 * HOLD_DURATION_MS).toISOString(),
      ),
    ]);
  });
});

// ---------- releaseSeats / bookSeats ----------

describe('releaseSeats', () => {
  it('releases every seat of the hold', async () => {
    await service.holdSeats(EVENT, 'h1', ['A-1', 'A-2']);

    await service.releaseSeats(EVENT, 'h1', ['A-1', 'A-2']);

    expect((await eventsOf('A-1')).at(-1)).toEqual({
      type: 'SeatReleased',
      holdId: 'h1',
    });
    expect((await eventsOf('A-2')).at(-1)).toEqual({
      type: 'SeatReleased',
      holdId: 'h1',
    });
  });
});

describe('bookSeats', () => {
  it('books every seat of a valid hold', async () => {
    await service.holdSeats(EVENT, 'h1', ['A-1', 'A-2']);

    await service.bookSeats(EVENT, 'h1', 'o1', ['A-1', 'A-2']);

    expect((await eventsOf('A-1')).at(-1)).toEqual({
      type: 'SeatBooked',
      holdId: 'h1',
      orderId: 'o1',
    });
    expect((await eventsOf('A-2')).at(-1)).toEqual({
      type: 'SeatBooked',
      holdId: 'h1',
      orderId: 'o1',
    });
  });

  it('rejects after the hold lapsed', async () => {
    await service.holdSeats(EVENT, 'h1', ['A-1']);
    clock.advance(HOLD_DURATION_MS);

    const rejections = await rejectionsOf(
      service.bookSeats(EVENT, 'h1', 'o1', ['A-1']),
    );

    expect(rejections).toEqual([
      { seatId: 'A-1', code: new HoldExpiredError().code },
    ]);
  });
});

// ---------- concurrency ----------

describe('concurrency', () => {
  /** Makes the first append lose a race: `competing` lands first, then the service's append runs. */
  function loseFirstRaceTo(competingHoldId: string) {
    const realAppend = store.appendAtomically.bind(store);
    return jest
      .spyOn(store, 'appendAtomically')
      .mockImplementationOnce(async (requests) => {
        await realAppend([
          {
            streamId: seatStreamId(EVENT, 'A-1'),
            expectedVersion: 0,
            events: [heldEvent(competingHoldId)],
          },
        ]);
        return realAppend(requests); // now stale → ConcurrencyError
      });
  }

  it('succeeds when the race was lost to a duplicate of the same hold', async () => {
    const spy = loseFirstRaceTo('h1');

    await expect(service.holdSeats(EVENT, 'h1', ['A-1'])).resolves.toEqual({
      holdId: 'h1',
      expiresAt: EXPIRY_ISO,
    });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(await eventsOf('A-1')).toHaveLength(1);
  });

  it('re-decides on retry and rejects when someone else won the race', async () => {
    loseFirstRaceTo('h-other');

    const rejections = await rejectionsOf(
      service.holdSeats(EVENT, 'h1', ['A-1']),
    );

    expect(rejections).toEqual([
      { seatId: 'A-1', code: new SeatAlreadyHeld().code },
    ]);
    expect(await eventsOf('A-1')).toEqual([heldEvent('h-other')]);
  });

  it('reads a fresh clock on every attempt', async () => {
    await service.holdSeats(EVENT, 'h1', ['A-1']);
    clock.set(new Date(T0.getTime() + HOLD_DURATION_MS - 1)); // 1 ms before expiry

    jest.spyOn(store, 'appendAtomically').mockImplementationOnce(async () => {
      clock.advance(1); // the retry now lands exactly at expiry
      throw new ConcurrencyError([seatStreamId(EVENT, 'A-1')]);
    });

    const rejections = await rejectionsOf(
      service.bookSeats(EVENT, 'h1', 'o1', ['A-1']),
    );

    expect(rejections).toEqual([
      { seatId: 'A-1', code: new HoldExpiredError().code },
    ]);
  });

  it('gives up after 3 attempts with the ConcurrencyError', async () => {
    const spy = jest
      .spyOn(store, 'appendAtomically')
      .mockRejectedValue(new ConcurrencyError(['any']));

    await expect(
      service.holdSeats(EVENT, 'h1', ['A-1']),
    ).rejects.toBeInstanceOf(ConcurrencyError);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('does not retry other errors', async () => {
    const spy = jest
      .spyOn(store, 'appendAtomically')
      .mockRejectedValueOnce(new Error('boom'));

    await expect(service.holdSeats(EVENT, 'h1', ['A-1'])).rejects.toThrow(
      'boom',
    );
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

// ---------- input guards ----------

describe('input guards', () => {
  it.each([
    ['no seats', []],
    ['duplicate seats', ['A-1', 'A-1']],
    ['more than 10 seats', Array.from({ length: 11 }, (_, i) => `A-${i + 1}`)],
  ])('rejects %s without touching the store', async (_, seatIds) => {
    const spy = jest.spyOn(store, 'appendAtomically');

    await expect(service.holdSeats(EVENT, 'h1', seatIds)).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
});

import { sql } from 'drizzle-orm';
import { Database } from './constants';
import { events, seatMapEntries, venues } from './schema';

const SECTIONS = ['Platea A', 'Platea B', 'Campo', 'Popular'];
const ROWS = 50;
const SEATS_PER_ROW = 100;

const VENUES = [
  { name: 'Estadio Monumental (River Plate)', city: 'Buenos Aires' },
  { name: 'Madison Square Garden', city: 'New York' },
  { name: 'Estadio José Amalfitani (Vélez)', city: 'Buenos Aires' },
  { name: 'Estadio Obras Sanitarias', city: 'Buenos Aires' },
  { name: 'Luna Park', city: 'Buenos Aires' },
  { name: 'Hipódromo de San Isidro', city: 'San Isidro' },
  { name: 'Wembley Arena', city: 'London' },
  { name: 'Tushino Airfield', city: 'Moscow' },
  { name: 'Maracanã', city: 'Rio de Janeiro' },
];

// venueIndex is 1-based, matching the array above
const EVENTS_PRE = [
  {
    title: 'Madonna — The Girlie Show',
    venueIndex: 0,
    startsAt: '1993-10-05T23:00:00Z',
  },
  {
    title: 'Madonna — Confessions Tour',
    venueIndex: 1,
    startsAt: '2006-08-01T19:30:00Z',
  },
  {
    title: 'Soda Stereo — El Último Concierto',
    venueIndex: 0,
    startsAt: '1997-09-20T23:00:00Z',
  },
  {
    title: "Guns N' Roses — Use Your Illusion",
    venueIndex: 0,
    startsAt: '1993-07-16T23:00:00Z',
  },
  {
    title: 'Metallica — Monsters of Rock Moscow',
    venueIndex: 1,
    startsAt: '1991-09-28T14:00:00Z',
  },
  {
    title: 'Queen — The Game Tour',
    venueIndex: 1,
    startsAt: '1981-02-28T23:00:00Z',
  },
  {
    title: 'Nirvana — Nevermind Tour',
    venueIndex: 1,
    startsAt: '1992-10-30T23:00:00Z',
  },
  {
    title: 'The Rolling Stones — Voodoo Lounge',
    venueIndex: 0,
    startsAt: '1995-02-09T23:00:00Z',
  },
  {
    title: 'Pink Floyd — The Division Bell',
    venueIndex: 0,
    startsAt: '1994-10-20T19:00:00Z',
  },
];

const EVENTS = EVENTS_PRE.map(({ title, startsAt, venueIndex }) => {
  return {
    title,
    startsAt,
    venue: VENUES[venueIndex].name,
  };
});

// ---------- helpers ----------
function* seatRows(venueId: string) {
  for (const section of SECTIONS) {
    for (let r = 1; r <= ROWS; r++) {
      for (let n = 1; n <= SEATS_PER_ROW; n++) {
        yield { venueId, section, rowLabel: `R${r}`, seatNumber: n };
      }
    }
  }
}

function chunk<T>(items: Iterable<T>, size: number): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  for (const item of items) {
    cur.push(item);
    if (cur.length === size) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

// ---------- seed ----------
export async function seedDb(db: Database) {
  const started = Date.now();

  return db.transaction(async (tx) => {
    // console.log('START');
    // Truncate first
    await tx.execute(
      sql`TRUNCATE TABLE events, seat_map_entries, venues CASCADE`,
    );

    // console.log('TRUNCATED');

    const inserted = await tx
      .insert(venues)
      .values(VENUES)
      .returning({ id: venues.id, name: venues.name });

    // console.log('VENUES INSERTED');

    const idByName = new Map(inserted.map((v) => [v.name, v.id]));

    for (const v of inserted) {
      for (const batch of chunk(seatRows(v.id), 1000)) {
        await tx.insert(seatMapEntries).values(batch);
      }
    }

    // console.log('SEATMAPS INSERTED');

    await tx.insert(events).values(
      EVENTS.map((e) => {
        const venueId = idByName.get(e.venue);
        if (!venueId) throw new Error(`Unknown venue in seed data: ${e.venue}`);
        return {
          venueId,
          title: e.title,
          startsAt: new Date(e.startsAt),
          onSaleAt: new Date(
            new Date(e.startsAt).getTime() - 60 * 24 * 60 * 60_000,
          ),
          status: 'on_sale',
        };
      }),
    );

    // console.log('EVENTS INSERTED');

    return {
      venues: VENUES.length,
      seats: VENUES.length * SECTIONS.length * ROWS * SEATS_PER_ROW,
      events: EVENTS.length,
      seconds: (Date.now() - started) / 1000,
    };
  });
}

import * as schema from '@org/catalog-schema/schema';
import { VenueLayout } from '@org/catalog-schema/types';
import { JobProgress } from 'bullmq/dist/esm/types';
import { sql } from 'drizzle-orm';
import { PgClient } from './constants';

type ProgressFn = (processed: JobProgress) => void;

interface Venue extends Pick<
  typeof schema.venues.$inferSelect,
  'name' | 'city' | 'latitude' | 'longitude'
> {
  layout: VenueLayout;
}

const venues: Venue[] = [
  {
    name: 'Estadio Monumental (River Plate)',
    city: 'Buenos Aires',
    latitude: -34.5453,
    longitude: -58.4498,
    layout: {
      sections: [
        {
          kind: 'seated',
          code: 'PLATEA-A',
          rows: [
            { label: '01', seats: 10 },
            { label: '02', seats: 10 },
          ],
        },
        {
          kind: 'standing',
          code: 'CAMPO',
          capacity: 10,
        },
        {
          kind: 'standing',
          code: 'CAMPO-VIP',
          capacity: 10,
        },
      ],
    },
  },
  // {
  //   name: 'Madison Square Garden',
  //   city: 'New York',
  //   latitude: 40.7505,
  //   longitude: -73.9934,
  // },
  // {
  //   name: 'Estadio José Amalfitani (Vélez)',
  //   city: 'Buenos Aires',
  //   latitude: -34.6353,
  //   longitude: -58.5208,
  // },
  // {
  //   name: 'Estadio Obras Sanitarias',
  //   city: 'Buenos Aires',
  //   latitude: -34.5447,
  //   longitude: -58.4606,
  // },
  // {
  //   name: 'Luna Park',
  //   city: 'Buenos Aires',
  //   latitude: -34.6021,
  //   longitude: -58.3686,
  // },
  // {
  //   name: 'Hipódromo de San Isidro',
  //   city: 'San Isidro',
  //   latitude: -34.4811,
  //   longitude: -58.5228,
  // },
  // {
  //   name: 'Wembley Arena',
  //   city: 'London',
  //   latitude: 51.558,
  //   longitude: -0.2825,
  // },
  // {
  //   name: 'Tushino Airfield',
  //   city: 'Moscow',
  //   latitude: 55.8264,
  //   longitude: 37.4361,
  // },
  // {
  //   name: 'Maracanã',
  //   city: 'Rio de Janeiro',
  //   latitude: -22.9122,
  //   longitude: -43.2302,
  // },
];

const prices = new Map([
  ['PLATEA-A', 350_00],
  ['CAMPO-VIP', 150_00],
  ['CAMPO', 60_00],
]);

const eventsPre = [
  {
    title: 'Madonna — The Girlie Show',
    venueIndex: 0,
    startsAt: '2026-10-05T23:00:00Z',
  },
  {
    title: 'Madonna — Confessions Tour',
    venueIndex: 0,
    startsAt: '2027-08-01T19:30:00Z',
  },
  // {
  //   title: 'Soda Stereo — El Último Concierto',
  //   venueIndex: 0,
  //   startsAt: '2027-09-20T23:00:00Z',
  // },
  // {
  //   title: "Guns N' Roses — Use Your Illusion",
  //   venueIndex: 0,
  //   startsAt: '2027-07-16T23:00:00Z',
  // },
  // {
  //   title: 'Metallica — Monsters of Rock Moscow',
  //   venueIndex: 1,
  //   startsAt: '2027-09-28T14:00:00Z',
  // },
  // {
  //   title: 'Queen — The Game Tour',
  //   venueIndex: 1,
  //   startsAt: '2027-02-28T23:00:00Z',
  // },
  // {
  //   title: 'Nirvana — Nevermind Tour',
  //   venueIndex: 1,
  //   startsAt: '2026-10-30T23:00:00Z',
  // },
  // {
  //   title: 'The Rolling Stones — Voodoo Lounge',
  //   venueIndex: 0,
  //   startsAt: '2027-02-09T23:00:00Z',
  // },
  // {
  //   title: 'Pink Floyd — The Division Bell',
  //   venueIndex: 0,
  //   startsAt: '2026-10-20T19:00:00Z',
  // },
];

const events = eventsPre.map((event) => {
  return {
    ...event,
    venue: venues[event.venueIndex].name,
  };
});

// ---------- seed ----------
export async function seedDb(pg: PgClient, onProgress: ProgressFn) {
  const started = Date.now();

  return pg.transaction(async (tx) => {
    // Truncate first
    await tx.execute(
      sql`TRUNCATE TABLE "catalog"."event_prices", "catalog"."events", "catalog"."venues" CASCADE`,
    );

    onProgress('truncated');

    const insertedVenues = await tx
      .insert(schema.venues)
      .values(venues)
      .returning({
        id: schema.venues.id,
        name: schema.venues.name,
        layout: schema.venues.layout,
      });

    onProgress('venues inserted');

    const idByName = new Map(insertedVenues.map((v) => [v.name, v.id]));

    const insertedEvents = await tx
      .insert(schema.events)
      .values(
        events.map((e) => {
          const venueId = idByName.get(e.venue);
          if (!venueId)
            throw new Error(`Unknown venue in seed data: ${e.venue}`);

          return {
            venueId,
            title: e.title,
            startsAt: new Date(e.startsAt),
            onSaleAt: new Date(
              new Date(e.startsAt).getTime() - 60 * 24 * 60 * 60_000,
            ),
            status: 'draft' as const,
          };
        }),
      )
      .returning({
        id: schema.events.id,
        title: schema.events.title,
        venueId: schema.events.venueId,
      });

    onProgress('events inserted');

    let eventSectionPricesCount = 0;

    for (const event of insertedEvents) {
      const [venue] = insertedVenues.filter((v) => v.id === event.venueId);

      if (!venue) {
        throw new Error(`No venue for ${event.title}`);
      }

      const insertedEventPrices = await tx
        .insert(schema.eventPrices)
        .values(
          venue.layout.sections.map((section) => {
            const priceCents = prices.get(section.code);

            if (priceCents === undefined) {
              throw new Error(`No price for section ${section.code}`);
            }

            return {
              eventId: event.id,
              section: section.code,
              priceCents,
            };
          }),
        )
        .returning();

      eventSectionPricesCount += insertedEventPrices.length;
    }

    onProgress('eventPrices inserted');

    onProgress({
      venues: insertedVenues.length,
      events: insertedEvents.length,
      eventPrices: eventSectionPricesCount,
      seconds: (Date.now() - started) / 1000,
    });
  });
}

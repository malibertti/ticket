import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CreateEventInput,
  CreateEventPricesInput,
  eventPrices,
  events,
  UpdateEventInput,
  venues,
} from '@org/catalog-schema/schema';
import {
  compareSections,
  EventPublishedInput,
  Page,
  PageQuery,
  sectionCodes,
} from '@org/catalog-schema/types';
import { CatalogEvent, TOPICS } from '@org/shared/kafka';
import { desc, eq, sql } from 'drizzle-orm';
import { PgClient } from '../db/constants';
import { OutboxService } from '../outbox/outbox.service';

@Injectable()
export class EventsService {
  // private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly pg: PgClient,
    private readonly outbox: OutboxService,
  ) {}

  async getEvents({ page, limit }: PageQuery): Promise<Page<any>> {
    const offset = (page - 1) * limit;

    const [rows, [{ count }]] = await Promise.all([
      this.pg
        .select()
        .from(events)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(events.createdAt)),
      this.pg.select({ count: sql<number>`count(*)::int` }).from(events),
    ]);

    return {
      items: rows,
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    };
  }

  async getEvent(id: string) {
    const rows = await this.pg
      .select({
        event: events,
        section: eventPrices.section,
        priceCents: eventPrices.priceCents,
        currency: eventPrices.currency,
      })
      .from(events)
      .leftJoin(eventPrices, eq(eventPrices.eventId, id))
      .where(eq(events.id, id));

    const event = rows[0]?.event;
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return {
      ...event,
      prices: rows.flatMap((row) =>
        row.section == null
          ? []
          : [
              {
                section: row.section,
                priceCents: row.priceCents,
                currency: row.currency,
              },
            ],
      ),
    };
  }

  async createEvent(input: CreateEventInput) {
    const [row] = await this.pg
      .insert(events)
      .values({
        ...input,
        startsAt: new Date(input.startsAt),
        onSaleAt: new Date(input.onSaleAt),
      })
      .returning();

    return row;
  }

  async updateEvent(eventId: string, input: UpdateEventInput) {
    return this.pg.transaction(async (tx) => {
      const [event] = await tx
        .update(events)
        .set(input)
        .where(eq(events.id, eventId))
        .returning();

      if (!event) {
        throw new NotFoundException({ error: 'EVENT_NOT_FOUND' });
      }

      const [venue] = await tx
        .select()
        .from(venues)
        .where(eq(venues.id, event.venueId));

      const prices = await tx
        .select({
          section: eventPrices.section,
          priceCents: eventPrices.priceCents,
        })
        .from(eventPrices)
        .where(eq(eventPrices.eventId, eventId));

      // Write to outbox
      await this.outbox.write(
        tx,
        TOPICS.catalogEvents,
        eventId,
        toKafkaEvent({
          ...event,
          eventId,
          prices,
          venueName: venue.name,
          city: venue.city,
          latitude: venue.latitude,
          longitude: venue.longitude,
          layout: venue.layout,
        }),
      );

      return {
        eventId,
        status: event.status,
      };
    });
  }

  async upsertPrices(eventId: string, pricesInput: CreateEventPricesInput) {
    const { status, prices } = await this.pg.transaction(async (tx) => {
      const [event] = await tx
        .select({
          status: events.status,
          layout: venues.layout,
          title: events.title,
          startsAt: events.startsAt,
          onSaleAt: events.onSaleAt,
          venueId: events.venueId,
          venueName: venues.name,
          city: venues.city,
          latitude: venues.latitude,
          longitude: venues.longitude,
        })
        .from(events)
        .innerJoin(venues, eq(venues.id, events.venueId))
        .where(eq(events.id, eventId))
        .for('no key update', { of: events });

      if (!event) {
        throw new NotFoundException({ error: 'EVENT_NOT_FOUND' });
      }

      const sections = pricesInput.map((p) => p.section);

      if (new Set(sections).size !== sections.length) {
        throw new UnprocessableEntityException({ error: 'DUPLICATE_SECTIONS' });
      }

      const { unknownSections, missingSections } = compareSections(
        sectionCodes(event.layout),
        sections,
      );

      if (unknownSections.length || missingSections.length) {
        throw new UnprocessableEntityException({
          error: 'PRICING_DOES_NOT_MATCH_LAYOUT',
          missingSections,
          unknownSections,
        });
      }

      // // rows for sections no longer in the layout would block open-sales forever
      // await tx
      //   .delete(eventPrices)
      //   .where(
      //     and(
      //       eq(eventPrices.eventId, eventId),
      //       notInArray(eventPrices.section, sections),
      //     ),
      //   );

      const prices = await tx
        .insert(eventPrices)
        .values(pricesInput.map((price) => ({ ...price, eventId })))
        .onConflictDoUpdate({
          target: [eventPrices.eventId, eventPrices.section],
          set: {
            priceCents: sql`excluded.price_cents`,
            updatedAt: sql`now()`,
          },
        })
        .returning();

      // Write to outbox
      if (event.status === 'on_sale') {
        await this.outbox.write(
          tx,
          TOPICS.catalogEvents,
          eventId,
          toKafkaEvent({
            ...event,
            eventId,
            prices,
          }),
        );
      }

      return {
        status: event.status,
        prices,
      };
    });

    return {
      eventId,
      status,
      prices,
    };
  }

  async openSales(eventId: string) {
    await this.pg.transaction(async (tx) => {
      const [event] = await tx
        .select({
          status: events.status,
          layout: venues.layout,
          title: events.title,
          startsAt: events.startsAt,
          onSaleAt: events.onSaleAt,
          venueId: events.venueId,
          venueName: venues.name,
          city: venues.city,
          latitude: venues.latitude,
          longitude: venues.longitude,
        })
        .from(events)
        .innerJoin(venues, eq(venues.id, events.venueId))
        .where(eq(events.id, eventId))
        .for('no key update', { of: events });

      if (!event) throw new NotFoundException({ error: 'EVENT_NOT_FOUND' });
      if (event.status === 'on_sale') return; // idempotent
      if (event.status !== 'draft') {
        throw new ConflictException({
          error: 'EVENT_NOT_DRAFT',
          status: event.status,
        });
      }

      const prices = await tx
        .select({
          section: eventPrices.section,
          priceCents: eventPrices.priceCents,
        })
        .from(eventPrices)
        .where(eq(eventPrices.eventId, eventId));

      const { missingSections, unknownSections } = compareSections(
        sectionCodes(event.layout),
        prices.map((p) => p.section),
      );

      if (missingSections.length || unknownSections.length) {
        throw new UnprocessableEntityException({
          error: 'PRICING_DOES_NOT_MATCH_LAYOUT',
          missingSections,
          unknownSections,
        });
      }

      await tx
        .update(events)
        .set({ status: 'on_sale' })
        .where(eq(events.id, eventId));

      // Write to outbox
      await this.outbox.write(
        tx,
        TOPICS.catalogEvents,
        eventId,
        toKafkaEvent({
          ...event,
          eventId,
          status: 'on_sale',
          prices,
        }),
      );
    });

    return {
      eventId,
      status: 'on_sale' as const,
    };
  }
}

/** Everything consumers need about an event, including what it takes to sell it. */
export function toKafkaEvent(input: EventPublishedInput): CatalogEvent {
  return {
    type: 'EventPublished',
    eventId: input.eventId,
    occurredAt: new Date().toISOString(),
    title: input.title,
    status: input.status,
    startsAt: input.startsAt.toISOString(),
    onSaleAt: input.onSaleAt.toISOString(),
    venueId: input.venueId,
    venueName: input.venueName,
    city: input.city,
    latitude: input.latitude,
    longitude: input.longitude,
    layout: input.layout,
    prices: Object.fromEntries(
      input.prices.map((p) => [p.section, p.priceCents]),
    ),
  };
}

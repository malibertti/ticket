import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CreateEventInput,
  CreateEventPricesInput,
  eventPrices,
  events,
  venues,
} from '@org/catalog-schema/schema';
import {
  compareSections,
  Page,
  PageQuery,
  sectionCodes,
} from '@org/catalog-schema/types';
import { desc, eq, sql } from 'drizzle-orm';
import { type Database, DB_CONNECTION } from '../db/constants';
import { InventoryService } from '../inventory/inventory.service';
import { SearchService } from '../search/search.service';
import { toEventDoc } from '../search/utils';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: Database,
    private readonly search: SearchService,
    private readonly inventory: InventoryService,
  ) {}

  async getEvents({ page, limit }: PageQuery): Promise<Page<any>> {
    const offset = (page - 1) * limit;

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(events)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(events.createdAt)),
      this.db.select({ count: sql<number>`count(*)::int` }).from(events),
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
    const rows = await this.db
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
    const [row] = await this.db
      .insert(events)
      .values({
        ...input,
        startsAt: new Date(input.startsAt),
        onSaleAt: new Date(input.onSaleAt),
      })
      .returning();

    if (row) {
      const [venue] = await this.db
        .select()
        .from(venues)
        .where(eq(venues.id, input.venueId));

      try {
        await this.search.indexEvent(toEventDoc(row, venue));
      } catch (err) {
        this.logger.warn({ err }, `Search indexing failed for event ${row.id}`);
      }
    }

    return row;
  }

  async upsertPrices(eventId: string, prices: CreateEventPricesInput) {
    const { status, rows } = await this.db.transaction(async (tx) => {
      const [event] = await tx
        .select({
          status: events.status,
          layout: venues.layout,
        })
        .from(events)
        .innerJoin(venues, eq(venues.id, events.venueId))
        .where(eq(events.id, eventId))
        .for('no key update', { of: events });

      if (!event) {
        throw new NotFoundException({ error: 'EVENT_NOT_FOUND' });
      }

      const sections = prices.map((p) => p.section);

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

      const rows = await tx
        .insert(eventPrices)
        .values(prices.map((price) => ({ ...price, eventId })))
        .onConflictDoUpdate({
          target: [eventPrices.eventId, eventPrices.section],
          set: {
            priceCents: sql`excluded.price_cents`,
            updatedAt: sql`now()`,
          },
        })
        .returning();

      return {
        status: event.status,
        rows,
      };
    });

    return {
      eventId,
      status,
      prices: rows,
      inventorySynced:
        status === 'on_sale'
          ? await this.inventory.syncSellableSeats(eventId)
          : null,
    };
  }
}

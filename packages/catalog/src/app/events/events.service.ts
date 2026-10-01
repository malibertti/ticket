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
import { Page, PageQuery, sectionCodes } from '@org/catalog-schema/types';
import { desc, eq, sql } from 'drizzle-orm';
import { type Database, DB_CONNECTION } from '../db/constants';
import { SearchService } from '../search/search.service';
import { toEventDoc } from '../search/utils';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: Database,
    private readonly search: SearchService,
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

  upsertPrices(eventId: string, prices: CreateEventPricesInput) {
    return this.db.transaction(async (tx) => {
      const [event] = await tx
        .select({ venueId: events.venueId })
        .from(events)
        .where(eq(events.id, eventId))
        .for('share');

      if (!event) {
        throw new NotFoundException('Event not found');
      }

      const [venue] = await tx
        .select({ layout: venues.layout })
        .from(venues)
        .where(eq(venues.id, event.venueId))
        .for('share');

      if (!venue?.layout) {
        throw new NotFoundException('Venue or Layout not found');
      }

      // Match layout
      const layoutSections = sectionCodes(venue.layout);
      const pricedSections = prices.map((price) => price.section);
      const priced = new Set(pricedSections);

      const missingSections = layoutSections.filter(
        (section) => !priced.has(section),
      );
      const unknownSections = pricedSections.filter(
        (section) => !new Set(layoutSections).has(section),
      );

      if (
        missingSections.length ||
        unknownSections.length ||
        priced.size !== pricedSections.length
      ) {
        throw new UnprocessableEntityException({
          error: 'PRICING_DOES_NOT_MATCH_LAYOUT',
          missingSections,
          unknownSections,
        });
      }

      return tx
        .insert(eventPrices)
        .values(prices.map((price) => ({ ...price, eventId })))
        .onConflictDoUpdate({
          target: [eventPrices.eventId, eventPrices.section],
          set: {
            priceCents: sql`excluded.price_cents`,
            updatedAt: new Date(),
          },
        })
        .returning();
    });
  }
}

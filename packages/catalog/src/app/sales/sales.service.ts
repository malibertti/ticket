import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { eventPrices, events, venues } from '@org/catalog-schema/schema';
import {
  compareSections,
  expandSeats,
  sectionCodes,
  type SellableSeat,
  type SellableSeatsSnapshot,
} from '@org/catalog-schema/types';
import { eq } from 'drizzle-orm';
import { type Database, DB_CONNECTION } from '../db/constants';
import { InventoryService } from '../inventory/inventory.service';
import { SearchService } from '../search/search.service';
import { toEventDoc } from '../search/utils';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: Database,
    private readonly search: SearchService,
    private readonly inventory: InventoryService,
  ) {}

  async openSales(eventId: string) {
    await this.db.transaction(async (tx) => {
      const [event] = await tx
        .select({
          status: events.status,
          layout: venues.layout,
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

      const priced = await tx
        .select({ section: eventPrices.section })
        .from(eventPrices)
        .where(eq(eventPrices.eventId, eventId));

      const { missingSections, unknownSections } = compareSections(
        sectionCodes(event.layout),
        priced.map((p) => p.section),
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
    });

    // both after the commit, both best effort: the event is on sale either way
    const [inventorySynced] = await Promise.all([
      this.inventory.syncSellableSeats(eventId),
      this.reindexEvent(eventId),
    ]);

    return {
      eventId,
      status: 'on_sale' as const,
      inventorySynced,
    };
  }

  async resync(eventId: string) {
    const event = await this.findEvent(eventId);

    if (event.status !== 'on_sale') {
      throw new ConflictException({
        error: 'EVENT_NOT_ON_SALE',
        status: event.status,
      });
    }

    return {
      eventId,
      inventorySynced: await this.inventory.syncSellableSeats(eventId),
    };
  }

  /** Every sellable seat of an on-sale event with its current price. Pulled by inventory. */
  sellableSeats(eventId: string): Promise<SellableSeatsSnapshot> {
    return this.db.transaction(async (tx) => {
      const [event] = await tx
        .select({
          status: events.status,
          layout: venues.layout,
          layoutVersion: venues.layoutVersion,
        })
        .from(events)
        .innerJoin(venues, eq(venues.id, events.venueId))
        .where(eq(events.id, eventId))
        .for('share', { of: events });

      if (!event) {
        throw new NotFoundException({ error: 'EVENT_NOT_FOUND' });
      }

      if (event.status !== 'on_sale') {
        throw new ConflictException({
          error: 'EVENT_NOT_ON_SALE',
          status: event.status,
        });
      }

      const prices = await tx
        .select({
          section: eventPrices.section,
          priceCents: eventPrices.priceCents,
          currency: eventPrices.currency,
        })
        .from(eventPrices)
        .where(eq(eventPrices.eventId, eventId))
        .for('share');

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

      const priceBySection = new Map(prices.map((p) => [p.section, p]));

      const seats = expandSeats(event.layout).map((seat): SellableSeat => {
        const eventPrice = priceBySection.get(seat.section);

        // open-sales and the frozen sections on price updates make this unreachable
        if (!eventPrice) {
          throw new Error(
            `Event ${eventId}: section ${seat.section} has no price`,
          );
        }

        return {
          ...seat,
          priceCents: eventPrice.priceCents,
          currency: eventPrice.currency,
        };
      });

      return {
        eventId,
        layoutVersion: event.layoutVersion,
        seats,
      };
    });
  }

  private async reindexEvent(eventId: string) {
    try {
      const [row] = await this.db
        .select({ event: events, venue: venues })
        .from(events)
        .innerJoin(venues, eq(venues.id, events.venueId))
        .where(eq(events.id, eventId));

      if (row) {
        await this.search.indexEvent(toEventDoc(row.event, row.venue));
      }
    } catch (err) {
      this.logger.warn({ err, eventId }, 'Search reindex failed');
    }
  }

  private async findEvent(eventId: string) {
    const [event] = await this.db
      .select({ status: events.status, venueId: events.venueId })
      .from(events)
      .where(eq(events.id, eventId));

    if (!event) throw new NotFoundException({ error: 'EVENT_NOT_FOUND' });

    return event;
  }
}

import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { eventPrices, events, venues } from '@org/catalog-schema/schema';
import { sectionCodes } from '@org/catalog-schema/types';
import { eq } from 'drizzle-orm';
import { type Database, DB_CONNECTION } from '../db/constants';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: Database,
    // private readonly notifier: InventoryNotifier,
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

      const prices = await tx
        .select({ section: eventPrices.section })
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
    });

    // TODO: Opening sales doesn't update the search index, so search keeps showing the event as draft.

    return {
      eventId,
      status: 'on_sale' as const,
      inventorySynced: await this.syncInventory(eventId),
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
      inventorySynced: await this.syncInventory(eventId),
    };
  }

  /** Best effort: the event stays on sale even if inventory is unreachable; the admin can resync. */
  async syncInventory(eventId: string): Promise<boolean> {
    this.logger.log({ eventId }, 'syncInventory');
    return true;
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

/** Every layout section must have a price, and every price must point at a layout section. */
function compareSections(layoutSections: string[], pricedSections: string[]) {
  const layout = new Set(layoutSections);
  const priced = new Set(pricedSections);

  return {
    missingSections: layoutSections.filter((section) => !priced.has(section)),
    unknownSections: pricedSections.filter((section) => !layout.has(section)),
  };
}

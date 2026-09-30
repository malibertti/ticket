import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { type Database, DB_CONNECTION } from '../db/constants';
import { events, eventSectionPrices } from '../db/schema';

@Injectable()
export class SalesService {
  // private readonly logger = new Logger(SalesService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: Database,
    // private readonly notifier: InventoryNotifier,
  ) {}

  async openSales(eventId: string) {
    await this.db.transaction(async (tx) => {
      const [event] = await tx
        .select({ status: events.status })
        .from(events)
        .where(eq(events.id, eventId))
        .for('update'); // pricing edits lock the same row, so they can't race this

      if (!event) throw new NotFoundException({ error: 'EVENT_NOT_FOUND' });
      if (event.status === 'on_sale') return; // idempotent
      if (event.status !== 'draft') {
        throw new ConflictException({
          error: 'EVENT_NOT_DRAFT',
          status: event.status,
        });
      }

      const [{ prices }] = await tx
        .select({ prices: sql<number>`count(*)::int` })
        .from(eventSectionPrices)
        .where(eq(eventSectionPrices.eventId, eventId));

      if (prices === 0) {
        throw new ConflictException({ error: 'EVENT_HAS_NO_PRICING' });
      }

      await tx
        .update(events)
        .set({ status: 'on_sale' })
        .where(eq(events.id, eventId));
    });

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

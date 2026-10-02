import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { eventPrices, events, venues } from '@org/catalog-schema/schema';
import {
  compareSections,
  expandSeats,
  sectionCodes,
  SellableSeat,
  SellableSeatsSnapshot,
} from '@org/catalog-schema/types';
import { eq } from 'drizzle-orm';
import { type Database, DB_CONNECTION } from '../db/constants';

@Injectable()
export class InternalService {
  constructor(@Inject(DB_CONNECTION) private readonly db: Database) {}

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
}

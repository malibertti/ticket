import { VenueLayout } from './venues';

export interface EventPublishedInput {
  eventId: string;
  title: string;
  status: string;
  startsAt: Date;
  onSaleAt: Date;
  venueId: string;
  layout: VenueLayout;
  prices: { section: string; priceCents: number }[];
}

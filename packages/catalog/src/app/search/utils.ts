import { events, venues } from '@org/catalog-schema/schema';

type Event = Pick<
  typeof events.$inferSelect,
  'id' | 'title' | 'startsAt' | 'onSaleAt' | 'status'
>;

type Venue = Pick<
  typeof venues.$inferSelect,
  'id' | 'name' | 'city' | 'latitude' | 'longitude'
>;

export interface EventDoc {
  id: string;
  title: string;
  venueId: string;
  venueName: string;
  city: string;
  startsAt: string;
  onSaleAt: string;
  status: string;
  location: {
    lat: number;
    lon: number;
  };
}

export function toEventDoc(event: Event, venue: Venue): EventDoc {
  return {
    id: event.id,
    title: event.title,
    venueId: venue.id,
    venueName: venue.name,
    city: venue.city,
    startsAt: event.startsAt.toISOString(),
    onSaleAt: event.onSaleAt.toISOString(),
    status: event.status,
    location: {
      lat: venue.latitude,
      lon: venue.longitude,
    },
  };
}

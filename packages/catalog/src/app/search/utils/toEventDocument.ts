import { events, venues } from '../../db/schema';

type EventRow = Pick<
  typeof events.$inferSelect,
  'id' | 'title' | 'startsAt' | 'status'
>;

type VenueRow = Pick<
  typeof venues.$inferSelect,
  'id' | 'name' | 'city' | 'latitude' | 'longitude'
>;

export interface EventDocument {
  id: string;
  title: string;
  venueId: string;
  venueName: string;
  city: string;
  startsAt: string;
  status: string;
  location: {
    lat: number;
    lon: number;
  };
}

export function toEventDocument(event: EventRow, venue: VenueRow) {
  console.log({ venue });

  return {
    id: event.id,
    title: event.title,
    venueId: venue.id,
    venueName: venue.name,
    city: venue.city,
    startsAt: event.startsAt.toISOString(),
    status: event.status,
    location: {
      lat: venue.latitude,
      lon: venue.longitude,
    },
  };
}

export interface EventDocument {
  id: string;
  title: string;
  venueId: string;
  venueName: string;
  city: string;
  startsAt: string;
  status: string;
}

interface Event {
  id: string;
  title: string;
  startsAt: Date;
  status: string;
}

interface Venue {
  id: string;
  name: string;
  city: string;
}

export function toEventDocument(event: Event, venue: Venue) {
  return {
    id: event.id,
    title: event.title,
    venueId: venue.id,
    venueName: venue.name,
    city: venue.city,
    startsAt: event.startsAt.toISOString(),
    status: event.status,
  };
}

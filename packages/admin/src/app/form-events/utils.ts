import { faker } from '@faker-js/faker';

export function randomVenue() {
  return {
    name: `${faker.company.name()} Arena`,
    city: faker.location.city(),
  };
}
export function randomEvent(venueId: string) {
  const now = new Date();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(20, 0, 0, 0);

  const endOfYear = new Date(tomorrow.getFullYear(), 11, 31, 20, 0, 0, 0);
  const startsAt = faker.date.between({ from: tomorrow, to: endOfYear });
  startsAt.setHours(20, 0, 0, 0);

  const twoWeeks = new Date(now);
  twoWeeks.setDate(twoWeeks.getDate() + 14);
  const onSaleAt = faker.date.between({ from: now, to: twoWeeks });

  return {
    venueId,
    title: `${faker.person.fullName()} — Live`,
    startsAt: toLocalInput(startsAt),
    onSaleAt: toLocalInput(onSaleAt),
    status: 'draft',
  };
}

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

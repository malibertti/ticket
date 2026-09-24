export const eventsMapping = {
  dynamic: 'strict',
  properties: {
    id: { type: 'keyword' },
    title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
    venueId: { type: 'keyword' },
    venueName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
    city: { type: 'keyword' },
    startsAt: { type: 'date' },
    onSaleAt: { type: 'date' },
    status: { type: 'keyword' },
  },
} as const;

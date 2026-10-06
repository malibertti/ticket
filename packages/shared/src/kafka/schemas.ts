/** Topics both services agree on, with the JSON Schema registered for each. */
export const TOPICS = {
  catalogEvents: 'catalog.events.v1',
  inventoryEvents: 'inventory.events.v1',
} as const;

export type Topic = (typeof TOPICS)[keyof typeof TOPICS];

/**
 * Subject naming: "<topic>-value", the registry's default. The registry rejects an
 * incompatible new version, so a breaking change means a new topic (…v2), not a new version.
 */
export function subjectFor(topic: Topic): string {
  return `${topic}-value`;
}

const section = {
  type: 'object',
  required: ['kind', 'code'],
  properties: {
    kind: { type: 'string', enum: ['seated', 'standing'] },
    code: { type: 'string' },
    capacity: { type: 'integer' },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        required: ['label', 'seats'],
        properties: {
          label: { type: 'string' },
          seats: { type: 'integer' },
        },
      },
    },
  },
};

/** What catalog publishes about an event: its details plus everything needed to sell it. */
const catalogEventSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'CatalogEvent',
  type: 'object',
  required: ['type', 'eventId', 'occurredAt'],
  properties: {
    type: { type: 'string', enum: ['EventPublished'] },
    eventId: { type: 'string' },
    occurredAt: { type: 'string' },
    title: { type: 'string' },
    status: { type: 'string' },
    startsAt: { type: 'string' },
    onSaleAt: { type: 'string' },
    venueId: { type: 'string' },
    layout: {
      type: 'object',
      required: ['sections'],
      properties: { sections: { type: 'array', items: section } },
    },
    prices: { type: 'object', additionalProperties: { type: 'integer' } },
  },
};

/** What inventory publishes: one message per stored event, as written to its streams. */
const inventoryEventSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'InventoryEvent',
  type: 'object',
  required: ['streamId', 'version', 'type', 'data', 'occurredAt'],
  properties: {
    streamId: { type: 'string' },
    version: { type: 'integer' },
    type: { type: 'string' },
    occurredAt: { type: 'string' },
    data: { type: 'object' },
  },
};

export const SCHEMAS: Record<Topic, object> = {
  [TOPICS.catalogEvents]: catalogEventSchema,
  [TOPICS.inventoryEvents]: inventoryEventSchema,
};

import { z } from 'zod';

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

const seatedSection = z.object({
  kind: z.literal('seated'),
  code: z.string(),
  rows: z.array(z.object({ label: z.string(), seats: z.number().int() })),
});

const standingSection = z.object({
  kind: z.literal('standing'),
  code: z.string(),
  capacity: z.number().int(),
});

const section = z.discriminatedUnion('kind', [seatedSection, standingSection]);

export const catalogEventSchema = z
  .strictObject({
    // strictObject → additionalProperties: false
    type: z.literal('EventPublished'),
    eventId: z.string(),
    occurredAt: z.string(),
    title: z.string(),
    status: z.string(),
    startsAt: z.string(),
    onSaleAt: z.string(),
    venueId: z.string(),
    venueName: z.string(),
    city: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    layout: z.object({ sections: z.array(section) }),
    prices: z.record(z.string(), z.number().int()),
  })
  .meta({ title: 'CatalogEvent' });

export const inventoryMessageSchema = z
  .strictObject({
    streamId: z.string(),
    version: z.number().int(),
    type: z.string(),
    occurredAt: z.string(),
    data: z.record(z.string(), z.unknown()),
  })
  .meta({ title: 'InventoryEvent' });

export type InventoryMessage = z.infer<typeof inventoryMessageSchema>;
export type CatalogEvent = z.infer<typeof catalogEventSchema>;

export const SCHEMAS: Record<Topic, object> = {
  [TOPICS.catalogEvents]: z.toJSONSchema(catalogEventSchema, {
    target: 'draft-7',
  }),
  [TOPICS.inventoryEvents]: z.toJSONSchema(inventoryMessageSchema, {
    target: 'draft-7',
  }),
};

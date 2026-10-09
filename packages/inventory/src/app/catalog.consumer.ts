import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import { Injectable } from '@nestjs/common';
import {
  type CatalogEvent,
  catalogEventSchema,
  KafkaConsumer,
  TOPICS,
} from '@org/shared/kafka';
import { Kafka } from 'kafkajs';
import { DbManifest } from './db/db.manifest';

/**
 * Keeps each on-sale event's manifest in Valkey, from catalog's events.
 * Writing a manifest is an overwrite, so replaying a message is harmless.
 */
@Injectable()
export class CatalogConsumer extends KafkaConsumer<CatalogEvent> {
  constructor(
    kafka: Kafka,
    registry: SchemaRegistry,
    private readonly dbManifest: DbManifest,
  ) {
    super(kafka, registry, TOPICS.catalogEvents, 'inventory-manifest');
  }

  protected async handle(message: CatalogEvent, key: string): Promise<void> {
    const parsed = catalogEventSchema.safeParse(message);

    // TODO: implement DLQ
    if (!parsed.success) {
      this.logger.error(
        { key, issues: parsed.error.issues },
        'Skipping invalid EventPublished',
      );
      return;
    }

    if (parsed.data.status === 'on_sale') {
      await this.dbManifest.set({
        eventId: parsed.data.eventId,
        layout: parsed.data.layout,
        prices: parsed.data.prices,
      });
    } else {
      await this.dbManifest.del(parsed.data.eventId);
    }
  }
}

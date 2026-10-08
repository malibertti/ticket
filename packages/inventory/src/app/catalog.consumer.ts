import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import { Injectable } from '@nestjs/common';
import type { Manifest } from '@org/catalog-schema/types';
import { KafkaConsumer, TOPICS } from '@org/shared/kafka';
import { LogMethod } from '@org/shared/logger';
import { Kafka } from 'kafkajs';
import { DbManifest } from './db/db.manifest';

/** The parts of catalog's EventPublished that inventory uses. */
interface EventPublished extends Manifest {
  type: 'EventPublished';
  status: string;
}

/**
 * Keeps each on-sale event's manifest in Valkey, from catalog's events.
 * Writing a manifest is an overwrite, so replaying a message is harmless.
 */
@Injectable()
export class CatalogConsumer extends KafkaConsumer<EventPublished> {
  constructor(
    kafka: Kafka,
    registry: SchemaRegistry,
    private readonly dbManifest: DbManifest,
  ) {
    super(kafka, registry, TOPICS.catalogEvents, 'inventory-manifest');
  }

  @LogMethod()
  protected async handle(message: EventPublished): Promise<void> {
    await this.dbManifest.set({
      eventId: message.eventId,
      layout: message.layout,
      prices: message.prices,
    });
  }
}

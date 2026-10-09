import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import { Injectable } from '@nestjs/common';
import {
  CatalogEvent,
  catalogEventSchema,
  KafkaConsumer,
  TOPICS,
} from '@org/shared/kafka';
import { Kafka } from 'kafkajs';
import { SearchService } from './search.service';
import { eventDocFromMessage } from './utils';

/**
 * Feeds search from catalog's own events (event-carried state transfer): each message holds
 * everything the search document needs, so there's no database read here.
 * On-sale events are indexed, anything else is removed. Both are overwrites, so a replay is harmless.
 */
@Injectable()
export class SearchConsumer extends KafkaConsumer<CatalogEvent> {
  constructor(
    kafka: Kafka,
    registry: SchemaRegistry,
    private readonly search: SearchService,
  ) {
    super(kafka, registry, TOPICS.catalogEvents, 'catalog-search');
  }

  protected async handle(message: CatalogEvent, key: string): Promise<void> {
    const parsed = catalogEventSchema.safeParse(message);

    // TODO: implement DLQ
    if (!parsed.success) {
      this.logger.error(
        { key, issues: parsed.error.issues },
        'Skipping invalid CatalogEvent',
      );
      return;
    }

    if (parsed.data.status === 'on_sale') {
      await this.search.indexEvent(eventDocFromMessage(parsed.data));
    } else {
      await this.search.removeEvent(parsed.data.eventId);
    }
  }
}

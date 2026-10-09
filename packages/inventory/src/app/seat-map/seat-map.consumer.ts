import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import { Injectable } from '@nestjs/common';
import {
  type InventoryMessage,
  KafkaConsumer,
  TOPICS,
} from '@org/shared/kafka';
import { Kafka } from 'kafkajs';
import { DbSeatMap } from '../db/db.seat-map';
import { parseSeatStreamId } from '../holds/utils';

/**
 * Keeps the seat map in Valkey from inventory's own events (the read side of CQRS).
 * A seat's events share a partition (keyed by streamId), so they arrive in order, and a
 * redelivery replays them in order too: each write overwrites, so the map ends up right.
 */
@Injectable()
export class SeatMapConsumer extends KafkaConsumer<InventoryMessage> {
  constructor(
    kafka: Kafka,
    registry: SchemaRegistry,
    private readonly seatMap: DbSeatMap,
  ) {
    super(kafka, registry, TOPICS.inventoryEvents, 'inventory-seat-map');
  }

  protected async handle(message: InventoryMessage): Promise<void> {
    const seat = parseSeatStreamId(message.streamId);

    if (!seat) {
      return; // hold streams don't change the seat map
    }

    const { eventId, seatId } = seat;

    switch (message.type) {
      case 'SeatHeld':
        await this.seatMap.held(
          eventId,
          seatId,
          message.data.expiresAt as string,
        );
        break;
      case 'SeatBooked':
        await this.seatMap.booked(eventId, seatId);
        break;
      case 'SeatReleased':
      case 'SeatExpired':
        await this.seatMap.available(eventId, seatId);
        break;
    }
  }
}

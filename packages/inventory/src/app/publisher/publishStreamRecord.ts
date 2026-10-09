import type { AttributeValue } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import {
  InventoryMessage,
  KafkaPublisher,
  TOPICS,
} from '@org/shared/kafka-core';

/** The parts of a DynamoDB stream record we read; Lambda events and the Streams API share this shape. */
export interface StreamRecordLike {
  eventName?: string;
  dynamodb?: {
    NewImage?: Record<string, AttributeValue>;
    SequenceNumber?: string;
  };
}

/**
 * Publishes a stored event to Kafka, keyed by its stream so each stream's events keep their order.
 * The traceparent stored with the event becomes the message header, continuing the trace of
 * whatever wrote it. Only inserts are events: the event store never updates or deletes.
 */
export async function publishStreamRecord(
  producer: KafkaPublisher,
  record: StreamRecordLike,
): Promise<void> {
  const image = record.dynamodb?.NewImage;

  if (record.eventName !== 'INSERT' || !image) {
    return;
  }

  const { streamId, version, type, occurredAt, data, traceparent } =
    unmarshall(image);

  const message: InventoryMessage = {
    streamId,
    version,
    type,
    occurredAt,
    data,
  };

  await producer.publish(
    TOPICS.inventoryEvents,
    streamId,
    message,
    traceparent ? { traceparent } : {},
  );
}

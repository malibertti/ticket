import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import { createKafka, KafkaPublisher } from '@org/shared/kafka-core';
import type { DynamoDBBatchResponse, DynamoDBStreamEvent } from 'aws-lambda';
import { publishStreamRecord, StreamRecordLike } from './publishStreamRecord';

/** Created once per Lambda container and reused across invocations. */
let producer: KafkaPublisher | undefined;

/**
 * DynamoDB Streams → inventory.events.v1. Records arrive in order per shard. On a failure, the
 * failed record is reported and the rest of the batch skipped, so AWS retries from that record
 * and nothing after it is published out of order. Requires ReportBatchItemFailures on the mapping.
 */
export async function handler(
  event: DynamoDBStreamEvent,
): Promise<DynamoDBBatchResponse> {
  const producer = getProducer();

  for (const record of event.Records) {
    try {
      // aws-lambda's AttributeValue type differs from the SDK's, but the shape is the same
      await publishStreamRecord(producer, record as StreamRecordLike);
    } catch (err) {
      console.error('Publishing stream record failed', err);

      return {
        batchItemFailures: [
          { itemIdentifier: record.dynamodb!.SequenceNumber! },
        ],
      };
    }
  }

  return { batchItemFailures: [] };
}

function getProducer(): KafkaPublisher {
  if (!producer) {
    const kafka = createKafka({
      clientId: 'inventory-stream-publisher',
      brokers: process.env.KAFKA_BROKERS!.split(','),
      awsRegion: process.env.AWS_REGION,
    });
    const registry = new SchemaRegistry({
      host: process.env.SCHEMA_REGISTRY_URL!,
    });

    producer = new KafkaPublisher(kafka, registry);
  }

  return producer;
}

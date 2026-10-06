import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';
import { Logger } from '@nestjs/common';
import { Kafka, logLevel } from 'kafkajs';
import { SCHEMAS, subjectFor, Topic } from './schemas';

export interface KafkaConfig {
  clientId: string;
  brokers: string[];
  schemaRegistryUrl: string;
}

export const KAFKA_CONFIG = Symbol('KAFKA_CONFIG');

export function createKafka({ clientId, brokers }: KafkaConfig): Kafka {
  return new Kafka({
    clientId,
    brokers,
    logLevel: logLevel.WARN,
    retry: { initialRetryTime: 300, retries: 8 },
  });
}

export function createSchemaRegistry({
  schemaRegistryUrl,
}: KafkaConfig): SchemaRegistry {
  return new SchemaRegistry({ host: schemaRegistryUrl });
}

/**
 * Registers a topic's schema and returns its id. Registering the same schema again is a no-op
 * that returns the existing id; an incompatible change is rejected by the registry.
 */
export async function registerSchema(
  registry: SchemaRegistry,
  topic: Topic,
  logger: Logger,
): Promise<number> {
  const { id } = await registry.register(
    { type: SchemaType.JSON, schema: JSON.stringify(SCHEMAS[topic]) },
    { subject: subjectFor(topic) },
  );

  logger.log({ topic, schemaId: id }, 'Schema registered');

  return id;
}

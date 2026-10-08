export interface KafkaConfig {
  clientId: string;
  brokers: string[];
  schemaRegistryUrl: string;
}

export const KAFKA_CONFIG = Symbol('KAFKA_CONFIG');

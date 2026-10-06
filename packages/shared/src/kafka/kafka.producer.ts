import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { currentTraceContext } from '../telemetry';
import { KAFKA_CONFIG, type KafkaConfig, registerSchema } from './kafka.client';
import { Topic } from './schemas';

@Injectable()
export class KafkaProducer implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducer.name);
  private readonly producer: Producer;
  private readonly schemaIds = new Map<Topic, Promise<number>>();
  private connected?: Promise<void>;

  constructor(
    kafka: Kafka,
    private readonly registry: SchemaRegistry,
    @Inject(KAFKA_CONFIG) config: KafkaConfig,
  ) {
    this.producer = kafka.producer({
      idempotent: true, // no duplicates from the producer's own retries
      allowAutoTopicCreation: false,
    });
    this.logger.debug({ clientId: config.clientId }, 'Producer created');
  }

  async onModuleDestroy() {
    if (this.connected) {
      await this.producer.disconnect();
    }
  }

  /**
   * Publishes one message, encoded against the topic's registered schema.
   * The key decides the partition, so messages with the same key keep their order.
   */
  async publish(topic: Topic, key: string, message: object): Promise<void> {
    await this.connect();

    const value = await this.registry.encode(
      await this.schemaId(topic),
      message,
    );

    await this.producer.send({
      topic,
      messages: [
        {
          key,
          value,
          headers: { ...currentTraceContext() },
        }, // continues this trace in the consumer
      ],
    });
  }

  private connect(): Promise<void> {
    this.connected ??= this.producer.connect();

    return this.connected;
  }

  private schemaId(topic: Topic): Promise<number> {
    let id = this.schemaIds.get(topic);

    if (!id) {
      id = registerSchema(this.registry, topic, this.logger);
      this.schemaIds.set(topic, id);
    }

    return id;
  }
}

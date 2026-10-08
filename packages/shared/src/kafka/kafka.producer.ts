import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { IHeaders, Kafka, Partitioners, Producer } from 'kafkajs';
import { currentTraceContext } from '../telemetry';
import { KAFKA_CONFIG, type KafkaConfig } from './config';
import { SCHEMAS, subjectFor, Topic } from './schemas';

@Injectable()
export class KafkaProducer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducer.name);
  private readonly producer: Producer;
  private readonly schemaIds = new Map<Topic, Promise<number>>();
  private connecting?: Promise<void>;

  constructor(
    kafka: Kafka,
    private readonly registry: SchemaRegistry,
    @Inject(KAFKA_CONFIG) config: KafkaConfig,
  ) {
    this.producer = kafka.producer({
      idempotent: true, // no duplicates from the producer's own retries
      allowAutoTopicCreation: false,
      createPartitioner: Partitioners.DefaultPartitioner,
      retry: { retries: Number.MAX_SAFE_INTEGER },
    });
    this.logger.debug({ clientId: config.clientId }, 'Producer created');
  }

  async onModuleInit() {
    try {
      await this.connect();
    } catch (err) {
      this.logger.warn(
        { err },
        'Producer did not connect, will retry on publish',
      );
    }
  }

  async onModuleDestroy() {
    try {
      await this.producer.disconnect();
      this.logger.debug('Producer disconnected');
    } catch (err) {
      this.logger.warn({ err }, 'Producer did not disconnect');
    }
  }

  /**
   * Publishes one message, encoded against the topic's registered schema.
   * The key decides the partition, so messages with the same key keep their order.
   */
  async publish(
    topic: Topic,
    key: string,
    message: object,
    headers: IHeaders = currentTraceContext(),
  ): Promise<void> {
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
          headers,
        },
      ],
    });
  }

  private connect(): Promise<void> {
    this.connecting ??= this.producer.connect().catch((err) => {
      this.connecting = undefined;
      throw err;
    });

    return this.connecting;
  }

  private schemaId(topic: Topic): Promise<number> {
    let id = this.schemaIds.get(topic);

    if (!id) {
      id = this.registerSchema(topic);
      this.schemaIds.set(topic, id);
    }

    return id;
  }

  private async registerSchema(topic: Topic) {
    const { id } = await this.registry.register(
      { type: SchemaType.JSON, schema: JSON.stringify(SCHEMAS[topic]) },
      { subject: subjectFor(topic) },
    );

    this.logger.log({ topic, schemaId: id }, 'Schema registered');

    return id;
  }
}

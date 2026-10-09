import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';
import { IHeaders, Kafka, Partitioners, Producer } from 'kafkajs';
import { SCHEMAS, subjectFor, Topic } from './schemas';

/**
 * Publishes schema-encoded messages. Plain class with no Nest, so Lambdas can use it;
 * Nest apps use KafkaProducer from @org/shared/kafka, which extends it.
 */
export class KafkaPublisher {
  private readonly producer: Producer;
  private readonly schemaIds = new Map<Topic, Promise<number>>();
  private connecting?: Promise<void>;

  constructor(
    kafka: Kafka,
    private readonly registry: SchemaRegistry,
  ) {
    this.producer = kafka.producer({
      idempotent: true, // no duplicates from the producer's own retries
      allowAutoTopicCreation: false,
      createPartitioner: Partitioners.DefaultPartitioner,
      retry: { retries: Number.MAX_SAFE_INTEGER },
    });
  }

  /**
   * Publishes one message, encoded against the topic's registered schema.
   * The key decides the partition, so messages with the same key keep their order.
   */
  async publish(
    topic: Topic,
    key: string,
    message: object,
    headers: IHeaders = {},
  ): Promise<void> {
    await this.connect();

    const value = await this.registry.encode(
      await this.schemaId(topic),
      message,
    );

    await this.producer.send({
      topic,
      messages: [{ key, value, headers }],
    });
  }

  /** Connects once; a failed attempt is forgotten so the next publish tries again. */
  connect(): Promise<void> {
    this.connecting ??= this.producer.connect().catch((err) => {
      this.connecting = undefined;
      throw err;
    });

    return this.connecting;
  }

  disconnect(): Promise<void> {
    this.connecting = undefined;

    return this.producer.disconnect();
  }

  protected async registerSchema(topic: Topic): Promise<number> {
    const { id } = await this.registry.register(
      { type: SchemaType.JSON, schema: JSON.stringify(SCHEMAS[topic]) },
      { subject: subjectFor(topic) },
    );

    return id;
  }

  private schemaId(topic: Topic): Promise<number> {
    let id = this.schemaIds.get(topic);

    if (!id) {
      id = this.registerSchema(topic);
      this.schemaIds.set(topic, id);
    }

    return id;
  }
}

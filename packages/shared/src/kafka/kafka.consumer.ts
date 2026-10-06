import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import {
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { context, trace } from '@opentelemetry/api';
import { Kafka, KafkaMessage } from 'kafkajs';
import { traceContextFrom } from '../telemetry';
import { Topic } from './schemas';

/**
 * Base class for a consumer: subscribes to one topic and calls handle() per message,
 * inside the trace of whoever published it.
 *
 * Offsets are committed after handle() returns, so a crash replays the last messages:
 * handlers must be idempotent.
 */
export abstract class KafkaConsumer<T>
  implements OnApplicationBootstrap, OnModuleDestroy
{
  protected readonly logger = new Logger(this.constructor.name);
  private readonly consumer;
  private readonly tracer = trace.getTracer('kafka');

  constructor(
    kafka: Kafka,
    private readonly registry: SchemaRegistry,
    private readonly topic: Topic,
    groupId: string,
  ) {
    this.consumer = kafka.consumer({ groupId });
  }

  async onApplicationBootstrap() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.topic, fromBeginning: true });
    await this.consumer.run({
      eachMessage: ({ message }) => this.consume(message),
    });

    this.logger.log({ topic: this.topic }, 'Consuming');
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }

  protected abstract handle(message: T, key: string): Promise<void>;

  private async consume(message: KafkaMessage) {
    const decoded = (await this.registry.decode(message.value!)) as T;
    const key = message.key?.toString() ?? '';
    const parent = traceContextFrom({
      traceparent: message.headers?.traceparent?.toString(),
    });

    await context.with(parent, () =>
      this.tracer.startActiveSpan(`${this.topic} process`, async (span) => {
        try {
          await this.handle(decoded, key);
        } catch (err) {
          span.recordException(err as Error);
          this.logger.error({ err, key }, 'Message handling failed');
          throw err; // kafkajs retries, then the consumer crashes rather than skipping
        } finally {
          span.end();
        }
      }),
    );
  }
}

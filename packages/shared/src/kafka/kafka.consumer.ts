import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import {
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { context, trace } from '@opentelemetry/api';
import { Kafka, type KafkaMessage } from 'kafkajs';
import { LogMethod } from '../logger';
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
  private readonly tracer = trace.getTracer('kafka');
  private readonly consumer;
  private stopped = false;

  protected abstract handle(message: T, key: string): Promise<void>;

  constructor(
    kafka: Kafka,
    private readonly registry: SchemaRegistry,
    private readonly topic: Topic,
    groupId: string,
  ) {
    this.consumer = kafka.consumer({ groupId });
  }

  onApplicationBootstrap() {
    void this.start();
  }

  async onModuleDestroy() {
    this.stopped = true;
    await this.consumer.disconnect();
  }

  private async start() {
    for (let attempt = 1; !this.stopped; attempt++) {
      try {
        await this.consumer.connect();
        await this.consumer.subscribe({
          topic: this.topic,
          fromBeginning: true,
        });
        await this.consumer.run({
          eachMessage: ({ message }) => this.consume(message),
        });

        this.logger.log({ topic: this.topic }, 'Consuming');
        return;
      } catch (err) {
        const delayMs = Math.min(30_000, 1_000 * 2 ** attempt);
        this.logger.warn(
          { err, topic: this.topic, attempt, retryInMs: delayMs },
          'Consumer could not start, retrying',
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  @LogMethod()
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

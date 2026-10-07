import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { outbox } from '@org/catalog-schema/schema';
import { KafkaProducer, Topic } from '@org/shared/kafka';
import { asc, inArray, isNull } from 'drizzle-orm';
import { PgClient } from '../db/constants';

/** Publishes queued outbox rows to Kafka, oldest first, then marks them published. */
@Injectable()
export class OutboxPoller implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPoller.name);
  private readonly intervalMs = 10_000; // just for dev
  private readonly batchSize = 100;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(PgClient) private readonly pg: PgClient,
    private readonly producer: KafkaProducer,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref(); // never keeps the process alive on its own
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /** One pass. Skipped while the previous one is still running, so rows are published once. */
  private async tick() {
    if (this.running) return;

    this.running = true;

    try {
      await this.publishBatch();
    } catch (err) {
      // the rows stay unpublished and the next tick retries them
      this.logger.warn({ err }, 'Outbox publish failed');
    } finally {
      this.running = false;
    }
  }

  private async publishBatch() {
    const rows = await this.pg
      .select()
      .from(outbox)
      .where(isNull(outbox.publishedAt))
      .orderBy(asc(outbox.id))
      .limit(this.batchSize);

    if (!rows.length) return;

    const published: number[] = [];

    try {
      // sequential: a topic's messages must reach Kafka in the order they were written
      for (const row of rows) {
        await this.producer.publish(row.topic as Topic, row.key, row.payload);
        published.push(row.id);
      }
    } finally {
      if (published.length) {
        await this.pg
          .update(outbox)
          .set({ publishedAt: new Date() })
          .where(inArray(outbox.id, published));

        this.logger.debug({ count: published.length }, 'Outbox published');
      }
    }
  }
}

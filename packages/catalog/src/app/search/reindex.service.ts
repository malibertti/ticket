import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';
import { JobProgress } from 'bullmq';
import { asc, count, eq, gt } from 'drizzle-orm';
import { type Database, DB_CONNECTION } from '../db/constants';
import { events, venues } from '../db/schema';
import {
  EVENTS_ALIAS,
  EVENTS_MAPPING,
  indexSettingsAnalysis,
  SEARCH,
} from './constants';
import { EventDoc, toEventDoc } from './utils';

const BATCH_SIZE = 500;

export type ReindexResult = {
  index: string;
  previousIndex: string | null;
  indexed: number;
  durationMs: number;
};

type ProgressFn = (processed: JobProgress) => void;

@Injectable()
export class ReindexService {
  private readonly logger = new Logger(ReindexService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: Database,
    @Inject(SEARCH) private readonly client: Client,
    private readonly cs: ConfigService,
  ) {}

  async run(onProgress: ProgressFn): Promise<ReindexResult> {
    const started = Date.now();
    const previousIndex = await this.currentIndex();
    const newIndex = `${EVENTS_ALIAS}_${started}`;

    this.logger.log(`Reindex: ${previousIndex ?? '(none)'} → ${newIndex}`);

    await this.createIndexForBulkLoad(newIndex);

    try {
      const indexed = await this.bulkLoad(newIndex, onProgress);
      await this.finalizeIndex(newIndex);
      await this.verify(newIndex);
      await this.swapAlias(previousIndex, newIndex);

      const durationMs = Date.now() - started;
      this.logger.log(
        `Reindex done: ${indexed} docs in ${durationMs}ms, alias → ${newIndex}`,
      );
      if (previousIndex) {
        this.logger.log(`Previous index ${previousIndex} kept for rollback`);
      }

      return { index: newIndex, previousIndex, indexed, durationMs };
    } catch (err) {
      this.logger.error(err as Error, `Reindex failed, deleting ${newIndex}`);
      await this.client.indices
        .delete({ index: newIndex })
        .catch(() => undefined);
      throw err;
    }
  }

  private async currentIndex(): Promise<string | null> {
    const { body: exists } = await this.client.indices.existsAlias({
      name: EVENTS_ALIAS,
    });
    if (!exists) return null;

    const { body } = await this.client.indices.getAlias({ name: EVENTS_ALIAS });
    return Object.keys(body)[0] ?? null;
  }

  private async createIndexForBulkLoad(index: string) {
    await this.client.indices.create(
      {
        index,
        body: {
          mappings: EVENTS_MAPPING,
          settings: {
            refresh_interval: '-1',
            number_of_replicas: this.cs.getOrThrow('OPENSEARCH_REPLICAS'),
            analysis: indexSettingsAnalysis,
          },
        },
      },
      {
        requestTimeout: 30_000,
        maxRetries: 0,
      },
    );
  }

  private async bulkLoad(
    index: string,
    onProgress: ProgressFn,
  ): Promise<number> {
    let dropped = 0;

    const result = await this.client.helpers.bulk<EventDoc>({
      datasource: this.eventDocuments(onProgress),
      onDocument: (doc) => ({ index: { _index: index, _id: doc.id } }),
      onDrop: (d) => {
        dropped++;
        this.logger.warn(
          `Dropped ${d.document.id}: ${JSON.stringify(d.error)}`,
        );
      },
      flushBytes: 5_000_000,
      concurrency: 3,
      retries: 3,
    });

    if (dropped > 0) {
      throw new Error(`${dropped} documents failed to index`);
    }
    return result.successful;
  }

  private async finalizeIndex(index: string) {
    await this.client.indices.putSettings({
      index,
      body: {
        refresh_interval: '1s',
        number_of_replicas: this.cs.getOrThrow('OPENSEARCH_REPLICAS'),
      },
    });

    await this.client.indices.refresh({ index });
  }

  private async verify(index: string) {
    const [{ value: expected }] = await this.db
      .select({ value: count() })
      .from(events);
    const { body } = await this.client.count({ index });

    if (body.count !== expected) {
      throw new Error(
        `Count mismatch: postgres=${expected} opensearch=${body.count}`,
      );
    }
  }

  private async swapAlias(previousIndex: string | null, newIndex: string) {
    await this.client.indices.updateAliases({
      body: {
        actions: [
          ...(previousIndex
            ? [{ remove: { index: previousIndex, alias: EVENTS_ALIAS } }]
            : []),
          { add: { index: newIndex, alias: EVENTS_ALIAS } },
        ],
      },
    });
  }

  private async *eventDocuments(
    onProgress: ProgressFn,
  ): AsyncGenerator<EventDoc> {
    let lastId: string | undefined;
    let processed = 0;

    while (true) {
      const rows = await this.db
        .select({
          id: events.id,
          title: events.title,
          startsAt: events.startsAt,
          onSaleAt: events.onSaleAt,
          status: events.status,
          venueId: venues.id,
          venueName: venues.name,
          city: venues.city,
          latitude: venues.latitude,
          longitude: venues.longitude,
        })
        .from(events)
        .innerJoin(venues, eq(events.venueId, venues.id))
        .where(lastId ? gt(events.id, lastId) : undefined)
        .orderBy(asc(events.id))
        .limit(BATCH_SIZE);

      if (rows.length === 0) return;

      for (const r of rows) {
        yield toEventDoc(
          {
            id: r.id,
            title: r.title,
            startsAt: r.startsAt,
            onSaleAt: r.onSaleAt,
            status: r.status,
          },
          {
            id: r.venueId,
            name: r.venueName,
            city: r.city,
            latitude: r.latitude,
            longitude: r.longitude,
          },
        );
      }

      lastId = rows.at(-1)!.id;
      processed += rows.length;
      onProgress(processed);
    }
  }
}

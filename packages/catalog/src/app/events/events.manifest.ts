import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { eventPrices, events, venues } from '@org/catalog-schema/schema';
import { Manifest, manifestKey } from '@org/catalog-schema/types';
import { eq } from 'drizzle-orm';
import { Valkey } from 'iovalkey';
import { PgClient } from '../db/constants';
import { EnvService } from '../env/env.service';

/** Writes on-sale events' manifests to Valkey, where inventory reads them on every hold. */
@Injectable()
export class EventsManifest implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly tracer = trace.getTracer('catalog');
  private readonly logger = new Logger(EventsManifest.name);
  private readonly valkey: Valkey;

  constructor(
    private readonly pg: PgClient,
    env: EnvService,
  ) {
    this.valkey = new Valkey(env.get('VALKEY_URL'), {
      maxRetriesPerRequest: 1, // fail fast: publishing is best effort
      commandTimeout: 2_000,
    });
  }

  /** Republishes every on-sale event, so a Valkey restart heals on the next deploy or restart. */
  onApplicationBootstrap() {
    // in the background: startup never waits on, or fails because of, Valkey or the database
    this.publishAllOnSale().catch((err) => {
      this.logger.warn({ err }, 'Manifest republish at startup failed');
    });
  }

  async onModuleDestroy() {
    await this.valkey.quit();
  }

  /** Best effort: never throws. Returns false so callers can report it and the admin can resync. */
  async publish(eventId: string): Promise<boolean> {
    return this.tracer.startActiveSpan('publish manifest', async (span) => {
      try {
        const manifest = await this.build(eventId);
        await this.valkey.set(manifestKey(eventId), JSON.stringify(manifest));
        return true;
      } catch (err) {
        this.logger.warn({ err, eventId }, 'Manifest publish failed');
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        return false;
      } finally {
        span.end();
      }
    });
  }

  private async build(eventId: string): Promise<Manifest> {
    const [event] = await this.pg
      .select({ layout: venues.layout })
      .from(events)
      .innerJoin(venues, eq(venues.id, events.venueId))
      .where(eq(events.id, eventId));

    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    const prices = await this.pg
      .select({
        section: eventPrices.section,
        priceCents: eventPrices.priceCents,
      })
      .from(eventPrices)
      .where(eq(eventPrices.eventId, eventId));

    return {
      eventId,
      layout: event.layout,
      prices: Object.fromEntries(prices.map((p) => [p.section, p.priceCents])),
    };
  }

  private async publishAllOnSale() {
    const onSale = await this.pg
      .select({ id: events.id })
      .from(events)
      .where(eq(events.status, 'on_sale'));

    for (const { id } of onSale) {
      await this.publish(id);
    }

    this.logger.log({ events: onSale.length }, 'Manifests republished');
  }
}

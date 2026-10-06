import { Injectable } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import {
  type Manifest,
  manifestKey,
  manifestSchema,
} from '@org/catalog-schema/types';
import { Valkey } from 'iovalkey';

/** Reads the manifests catalog publishes to Valkey. */
@Injectable()
export class DbManifest {
  private readonly tracer = trace.getTracer('inventory');

  constructor(private readonly valkey: Valkey) {}

  /** The event's manifest, or undefined when nothing is published (the event isn't on sale). */
  async get(eventId: string): Promise<Manifest | undefined> {
    return this.tracer.startActiveSpan('valkey get manifest', async (span) => {
      try {
        const raw = await this.valkey.get(manifestKey(eventId));

        return raw ? manifestSchema.parse(JSON.parse(raw)) : undefined;
      } finally {
        span.end();
      }
    });
  }
}

import { Injectable } from '@nestjs/common';
import {
  type Manifest,
  manifestKey,
  manifestSchema,
} from '@org/catalog-schema/types';
import { Valkey } from 'iovalkey';

/** Reads the manifests catalog publishes to Valkey. */
@Injectable()
export class DbManifest {
  constructor(private readonly valkey: Valkey) {}

  /** The event's manifest, or undefined when nothing is published (the event isn't on sale). */
  async get(eventId: string): Promise<Manifest | undefined> {
    const raw = await this.valkey.get(manifestKey(eventId));

    return raw ? manifestSchema.parse(JSON.parse(raw)) : undefined;
  }
}

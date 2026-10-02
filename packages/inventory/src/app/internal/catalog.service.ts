import { Injectable } from '@nestjs/common';
import {
  sellableSeatsSnapshotSchema,
  type SellableSeatsSnapshot,
} from '@org/catalog-schema/types';
import { EnvService } from '../env/env.service';

@Injectable()
export class CatalogService {
  // private readonly logger = new Logger(CatalogService.name);
  private readonly timeoutMs = 30_000;

  constructor(private readonly env: EnvService) {}

  /** Pulls the event's sellable seats from catalog and validates them against the shared contract. */
  async sellableSeats(eventId: string): Promise<SellableSeatsSnapshot> {
    const baseUrl = this.env.get('CATALOG_BASE_URL');

    const url = new URL(
      `/internal/events/${encodeURIComponent(eventId)}/sellable-seats`,
      baseUrl,
    );

    const res = await fetch(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`Catalog responded ${res.status} for event ${eventId}`);
    }

    const snapshot = sellableSeatsSnapshotSchema.parse(await res.json());

    if (snapshot.eventId !== eventId) {
      throw new Error(
        `Catalog returned event ${snapshot.eventId}, expected ${eventId}`,
      );
    }

    return snapshot;
  }
}

import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { SellableSeatsService } from './sellable-seats.service';

@Injectable()
export class SyncService implements OnApplicationShutdown {
  private readonly logger = new Logger(SyncService.name);
  private readonly running = new Map<string, Promise<void>>();
  private readonly pending = new Set<string>();

  constructor(
    private readonly catalog: CatalogService,
    private readonly sellableSeats: SellableSeatsService,
  ) {}

  /**
   * Starts a sync in the background and returns immediately.
   * Requests arriving while a sync for the same event runs collapse into one follow-up run,
   * so the last price change always wins.
   */
  request(eventId: string): void {
    if (this.running.has(eventId)) {
      this.pending.add(eventId);
      return;
    }

    const run = this.runUntilIdle(eventId).finally(() =>
      this.running.delete(eventId),
    );
    this.running.set(eventId, run);
  }

  async onApplicationShutdown() {
    await Promise.allSettled(this.running.values());
  }

  private async runUntilIdle(eventId: string) {
    do {
      this.pending.delete(eventId);

      try {
        await this.sync(eventId);
      } catch (err) {
        // the admin can resync from catalog
        this.logger.error({ err, eventId }, 'Sellable seats sync failed');
      }
    } while (this.pending.has(eventId));
  }

  private async sync(eventId: string) {
    const startedAt = Date.now();
    const snapshot = await this.catalog.sellableSeats(eventId);

    await this.sellableSeats.writeSnapshot(snapshot);

    this.logger.log(
      { eventId, seats: snapshot.seats.length, ms: Date.now() - startedAt },
      'Sellable seats synced',
    );
  }
}

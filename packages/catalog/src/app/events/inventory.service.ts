import { Injectable, Logger } from '@nestjs/common';
import { EnvService } from '../env/env.service';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  private readonly timeoutMs = 10_000;

  constructor(private readonly env: EnvService) {}

  /**
   * Tells inventory that an event's sellable seats changed; inventory pulls the snapshot itself.
   * Best effort: never throws. Returns false when inventory is not configured or did not accept it,
   * so callers can report it and the admin can resync.
   */
  async syncSellableSeats(eventId: string): Promise<boolean> {
    const baseUrl = this.env.get('INVENTORY_BASE_URL');

    if (!baseUrl) {
      this.logger.warn(
        { eventId },
        'INVENTORY_BASE_URL not set, skipping sync',
      );
      return false;
    }

    const url = new URL(
      `/internal/events/${encodeURIComponent(eventId)}/sellable-seats/sync`,
      baseUrl,
    );

    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        this.logger.warn(
          { eventId, status: res.status },
          'Inventory rejected the sync',
        );
        return false;
      }

      return true;
    } catch (err) {
      this.logger.warn({ err, eventId }, 'Inventory sync failed');
      return false;
    }
  }
}

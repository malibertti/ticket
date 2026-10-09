import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Public } from '@org/shared/auth';
import { DbEventStore } from '../db/db.event-store';
import { DbManifest } from '../db/db.manifest';
import { DbSeatMap } from '../db/db.seat-map';

@Controller('events/:eventId/availability')
@Public()
export class SeatMapController {
  constructor(
    private readonly manifests: DbManifest,
    private readonly seatMap: DbSeatMap,
    private readonly eventStore: DbEventStore,
  ) {}

  /**
   * Taken seats (any seat not listed is available) and places left per standing section.
   * Seats come from the read model, so they can trail a hold by about a second;
   * standing comes from the counters themselves.
   */
  @Get()
  async get(@Param('eventId', ParseUUIDPipe) eventId: string) {
    const manifest = await this.manifests.get(eventId);

    if (!manifest) {
      throw new NotFoundException('Event is not on sale');
    }

    const [seats, taken] = await Promise.all([
      this.seatMap.get(eventId, new Date()),
      this.eventStore.readCounters(eventId),
    ]);

    const standing: Record<string, { capacity: number; available: number }> =
      {};

    for (const section of manifest.layout.sections) {
      if (section.kind === 'standing') {
        standing[section.code] = {
          capacity: section.capacity,
          available: Math.max(0, section.capacity - (taken[section.code] ?? 0)),
        };
      }
    }

    return {
      eventId,
      seats,
      standing,
    };
  }
}

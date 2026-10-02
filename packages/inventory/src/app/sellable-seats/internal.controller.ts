import {
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { Public } from '@org/shared/auth';
import { SyncService } from './sync.service';

@Controller({
  path: 'internal/events',
  version: VERSION_NEUTRAL,
})
@Public()
export class InternalController {
  constructor(private readonly sync: SyncService) {}

  @Post(':eventId/sellable-seats/sync')
  @HttpCode(202)
  syncSellableSeats(@Param('eventId', ParseUUIDPipe) eventId: string) {
    this.sync.request(eventId);

    return {
      eventId,
      accepted: true,
    };
  }
}

import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { Public } from '@org/shared/auth';
import { SalesService } from './sales.service';

@Controller({
  path: 'internal/events',
  version: VERSION_NEUTRAL,
})
@Public()
export class InternalController {
  constructor(private readonly sales: SalesService) {}

  // TODO: block /internal/* at CloudFront or the ALB.
  @Get(':eventId/sellable-seats')
  sellableSeats(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.sales.sellableSeats(eventId);
  }
}

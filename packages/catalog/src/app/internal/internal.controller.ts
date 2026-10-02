import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { Public } from '@org/shared/auth';
import { InternalService } from './internal.service';

@Controller({
  path: 'internal',
  version: VERSION_NEUTRAL,
})
@Public()
export class InternalController {
  constructor(private readonly internal: InternalService) {}

  // TODO: block /internal/* at CloudFront or the ALB.
  @Get('events/:eventId/sellable-seats')
  sellableSeats(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.internal.sellableSeats(eventId);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  createEventPrices,
  type CreateEventPricesInput,
} from '@org/catalog-schema/schema';
import { Roles } from '@org/shared/auth';
import { ZodPipe } from '@org/shared/pipes';
import { EventsService } from './events.service';

@Controller('events/:eventId')
export class EventController {
  constructor(private readonly events: EventsService) {}

  @Put('prices')
  @Roles(['admins'])
  createEventPrices(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body(new ZodPipe(createEventPrices)) body: CreateEventPricesInput,
  ) {
    return this.events.upsertPrices(eventId, body);
  }

  // TODO: block /internal/* at CloudFront or the ALB.
  @Get('sellable-seats')
  sellableSeats(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.events.sellableSeats(eventId);
  }

  @Post('open-sales')
  @HttpCode(200)
  openSales(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.events.openSales(eventId);
  }

  @Post('resync')
  @HttpCode(200)
  resync(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.events.resync(eventId);
  }
}

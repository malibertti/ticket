import {
  Body,
  Controller,
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
@Roles(['admins'])
export class EventController {
  constructor(private readonly events: EventsService) {}

  @Put('prices')
  createEventPrices(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body(new ZodPipe(createEventPrices)) body: CreateEventPricesInput,
  ) {
    return this.events.upsertPrices(eventId, body);
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

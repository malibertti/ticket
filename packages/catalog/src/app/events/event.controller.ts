import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  createEventPrices,
  updateEventInput,
  type CreateEventPricesInput,
  type UpdateEventInput,
} from '@org/catalog-schema/schema';
import { Roles } from '@org/shared/auth';
import { ZodPipe } from '@org/shared/pipes';
import { EventsService } from './events.service';

@Controller('events/:eventId')
@Roles(['admins'])
export class EventController {
  constructor(private readonly events: EventsService) {}

  @Patch()
  updateEvent(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body(new ZodPipe(updateEventInput)) body: UpdateEventInput,
  ) {
    return this.events.updateEvent(eventId, body);
  }

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
}

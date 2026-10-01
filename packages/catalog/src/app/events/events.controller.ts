import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  createEventInput,
  type CreateEventInput,
  createEventPrices,
  type CreateEventPricesInput,
} from '@org/catalog-schema/schema';
import { type PageQuery, pageQuery } from '@org/catalog-schema/types';
import { Public, Roles } from '@org/shared/auth';
import { ZodPipe } from '@org/shared/pipes';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @Public()
  getEvents(@Query(new ZodPipe(pageQuery)) query: PageQuery) {
    return this.events.getEvents(query);
  }

  @Get(':id')
  @Public()
  getEvent(@Param('id', ParseUUIDPipe) id: string) {
    return this.events.getEvent(id);
  }

  @Post()
  @Roles(['admins'])
  createEvent(@Body(new ZodPipe(createEventInput)) body: CreateEventInput) {
    return this.events.createEvent(body);
  }

  @Put(':eventId/prices')
  @Roles(['admins'])
  createEventPrices(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body(new ZodPipe(createEventPrices)) body: CreateEventPricesInput,
  ) {
    return this.events.upsertPrices(eventId, body);
  }
}

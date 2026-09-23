import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  type CreateEventInput,
  type PageQuery,
  pageQuery,
} from '@org/contracts';
import { ZodPipe } from '../pipes/zod/zod.pipe';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  getVenues(@Query(new ZodPipe(pageQuery)) query: PageQuery) {
    return this.events.getEvents(query);
  }

  @Get(':id')
  getVenue(@Param('id', ParseUUIDPipe) id: string) {
    return this.events.getEvent(id);
  }

  @Post()
  createVenue(@Body() body: CreateEventInput) {
    return this.events.createEvent(body);
  }
}

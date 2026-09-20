import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { type PageQuery, pageQuery } from '@org/contracts';
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
}

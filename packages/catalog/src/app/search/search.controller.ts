import { Controller, Get, Query } from '@nestjs/common';
import { type SearchEventsQuery, searchEventsQuery } from '@org/contracts';
import { Public } from '@org/shared/auth';
import { ZodPipe } from '@org/shared/pipes';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Public()
  @Get('events')
  searchEvents(
    @Query(new ZodPipe(searchEventsQuery)) query: SearchEventsQuery,
  ) {
    return this.search.searchEvents(query);
  }
}

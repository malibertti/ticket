import { Controller, Get, Query } from '@nestjs/common';
import { type SearchEventsQuery, searchEventsQuery } from '@org/contracts';
import { Public } from '../auth/public.decorator';
import { ZodPipe } from '../pipes/zod/zod.pipe';
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

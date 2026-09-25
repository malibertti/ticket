import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { type PageQuery, pageQuery } from '@org/contracts';
import { type Response } from 'express';
import { Public } from '../auth/public.decorator';
import { ZodPipe } from '../pipes/zod/zod.pipe';
import { VenuesService } from './venues.service';

@Controller('venues')
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get()
  @Public()
  getVenues(@Query(new ZodPipe(pageQuery)) query: PageQuery) {
    return this.venues.getVenues(query);
  }

  @Get(':id')
  @Public()
  getVenue(@Param('id', ParseUUIDPipe) id: string) {
    return this.venues.getVenue(id);
  }

  @Get(':id/seat-map')
  @Public()
  async seatMap(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const venue = await this.venues.getVenue(id);
    const seatMap = await this.venues.seatMap(id);

    res.set({
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      ETag: `W/"seatmap-${id}-v${venue.seatMapVersion}"`,
      Vary: 'Accept-Encoding',
    });

    return seatMap;
  }
}

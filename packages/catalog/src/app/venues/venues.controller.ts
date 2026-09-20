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
import { ZodPipe } from '../pipes/zod/zod.pipe';
import { VenuesService } from './venues.service';

@Controller('venues')
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get()
  getVenues(@Query(new ZodPipe(pageQuery)) query: PageQuery) {
    return this.venues.getVenues(query);
  }

  // @Get()
  // @Version('2')
  // getVenues2(@Query(new ZodPipe(pageQuery)) query: PageQuery) {
  //   return ['hello', 'version', '2', query];
  // }

  @Get(':id')
  getVenue(@Param('id', ParseUUIDPipe) id: string) {
    return this.venues.getVenue(id);
  }

  @Get(':id/seat-map')
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

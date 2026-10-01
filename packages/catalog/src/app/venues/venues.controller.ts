import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { type PageQuery, pageQuery } from '@org/catalog-schema/types';
import { Public } from '@org/shared/auth';
import { ZodPipe } from '@org/shared/pipes';
import { type Response } from 'express';
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
  async getVenue(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const venue = await this.venues.getVenue(id);

    res.set({
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      ETag: `W/"seatmap-${id}-v${venue.layoutVersion}"`,
      Vary: 'Accept-Encoding',
    });

    return venue;
  }
}

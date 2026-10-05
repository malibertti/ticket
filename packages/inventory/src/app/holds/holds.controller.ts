import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseFilters,
} from '@nestjs/common';
import { Public } from '@org/shared/auth';
import { ZodPipe } from '@org/shared/pipes';
import { HoldsErrorsFilter } from './holds-errors.filter';
import {
  type BookDto,
  bookSchema,
  type HoldDto,
  holdSchema,
} from './holds.dto';
import { HoldsService } from './holds.service';

@Controller('events/:eventId/holds')
@Public()
@UseFilters(HoldsErrorsFilter)
export class HoldsController {
  constructor(private readonly holds: HoldsService) {}

  @Post()
  hold(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body(new ZodPipe(holdSchema)) body: HoldDto,
  ) {
    return this.holds.placeHold(
      eventId,
      body.holdId,
      body.seatIds ?? [],
      body.standing ?? [],
    );
  }

  @Post(':holdId/release')
  @HttpCode(204)
  release(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('holdId', ParseUUIDPipe) holdId: string,
  ) {
    return this.holds.releaseHold(eventId, holdId);
  }

  @Post(':holdId/book')
  @HttpCode(204)
  book(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('holdId', ParseUUIDPipe) holdId: string,
    @Body(new ZodPipe(bookSchema)) body: BookDto,
  ) {
    return this.holds.bookHold(eventId, holdId, body.orderId);
  }
}

import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseFilters,
} from '@nestjs/common';
import { ZodPipe } from '@org/shared/pipes';
import { HoldsErrorsFilter } from './holds-errors.filter';
import {
  type BookSeatsDto,
  bookSeatsSchema,
  type HoldSeatsDto,
  holdSeatsSchema,
  type HoldStandingDto,
  holdStandingSchema,
  type ReleaseSeatsDto,
  releaseSeatsSchema,
} from './holds.dto';
import { HoldsService } from './holds.service';

@Controller('events/:eventId/holds')
@UseFilters(HoldsErrorsFilter)
export class HoldsController {
  constructor(private readonly seats: HoldsService) {}

  @Post()
  hold(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body(new ZodPipe(holdSeatsSchema)) body: HoldSeatsDto,
  ) {
    return this.seats.holdSeats(eventId, body.holdId, body.seatIds);
  }

  @Post('standing')
  holdStanding(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body(new ZodPipe(holdStandingSchema)) body: HoldStandingDto,
  ) {
    return this.seats.holdStanding(
      eventId,
      body.holdId,
      body.section,
      body.quantity,
    );
  }

  @Post(':holdId/release')
  @HttpCode(204)
  release(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('holdId', ParseUUIDPipe) holdId: string,
    @Body(new ZodPipe(releaseSeatsSchema)) body: ReleaseSeatsDto,
  ) {
    return this.seats.releaseSeats(eventId, holdId, body.seatIds);
  }

  @Post(':holdId/book')
  @HttpCode(204)
  book(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('holdId', ParseUUIDPipe) holdId: string,
    @Body(new ZodPipe(bookSeatsSchema)) body: BookSeatsDto,
  ) {
    return this.seats.bookSeats(eventId, holdId, body.orderId, body.seatIds);
  }
}

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
import {
  type BookSeatsDto,
  bookSeatsSchema,
  type HoldSeatsDto,
  holdSeatsSchema,
  type ReleaseSeatsDto,
  releaseSeatsSchema,
} from './holds.dto';
import { SeatErrorsFilter } from './seat-errors.filter';
import { SeatsService } from './seats.service';

@Controller('events/:eventId/holds')
@UseFilters(SeatErrorsFilter)
export class HoldsController {
  constructor(private readonly seats: SeatsService) {}

  @Post()
  hold(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body(new ZodPipe(holdSeatsSchema)) body: HoldSeatsDto,
  ) {
    return this.seats.holdSeats(eventId, body.holdId, body.seatIds);
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

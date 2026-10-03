import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { ConcurrencyError } from '../db/db.event-store';
import {
  HoldExpiredError,
  SeatCommandRejected,
  UnknownSeat,
} from './domain/errors';

@Catch(SeatCommandRejected, ConcurrencyError)
export class HoldsErrorsFilter implements ExceptionFilter {
  private readonly holdExpired = new HoldExpiredError().code;
  private readonly unknownSeat = new UnknownSeat().code;

  catch(err: SeatCommandRejected | ConcurrencyError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (err instanceof ConcurrencyError) {
      // retries exhausted: nothing is wrong with the request, try again shortly
      res.status(409).json({
        error: 'CONCURRENT_MODIFICATION',
        retryable: true,
      });
      return;
    }

    if (err.rejections.some((r) => r.code === this.unknownSeat)) {
      res.status(422).json({
        error: 'SEATS_NOT_FOR_SALE',
        retryable: false,
        rejections: err.rejections,
      });
      return;
    }

    // 410 only when every rejection is an expired hold; any real conflict wins
    const allExpired = err.rejections.every((r) => r.code === this.holdExpired);

    res.status(allExpired ? 410 : 409).json({
      error: allExpired ? 'HOLD_EXPIRED' : 'SEATS_UNAVAILABLE',
      retryable: false,
      rejections: err.rejections,
    });
  }
}

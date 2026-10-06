import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { LogMethod } from '@org/shared/logger';
import { Queue } from 'bullmq';
import { JOBS, QUEUES } from '../queues/constants';

export interface HoldExpiryJob {
  eventId: string;
  holdId: string;
}

@Injectable()
export class HoldExpiryProducer {
  private readonly logger = new Logger(HoldExpiryProducer.name);
  private readonly graceMs = 2_000; // so clock drift rarely runs the job before the hold lapsed

  constructor(
    @InjectQueue(QUEUES.holdExpiry)
    private readonly queue: Queue<HoldExpiryJob>,
  ) {}

  /**
   * Schedules the hold's expiry. Fire and forget: a hold never waits on Valkey.
   * One job per hold: BullMQ ignores a second add with the same jobId.
   */
  @LogMethod()
  schedule(eventId: string, holdId: string, expiresAt: string): void {
    const delay =
      Math.max(0, new Date(expiresAt).getTime() - Date.now()) + this.graceMs;

    this.queue
      .add(
        JOBS.expireHold,
        { eventId, holdId },
        {
          jobId: `expire-${eventId}-${holdId}`,
          delay,
          attempts: 5,
          backoff: { type: 'exponential', delay: 1_000 },
        },
      )
      .catch((err) => {
        this.logger.warn(
          { err, eventId, holdId },
          'Could not schedule hold expiry',
        );
      });
  }
}

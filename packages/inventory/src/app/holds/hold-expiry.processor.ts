import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { LogMethod } from '@org/shared/logger';
import { Job } from 'bullmq';
import { QUEUES } from '../queues/constants';
import { HoldExpiryJob } from './hold-expiry.producer';
import { HoldsService } from './holds.service';

@Processor(QUEUES.holdExpiry)
export class HoldExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(HoldExpiryProcessor.name);

  constructor(private readonly holds: HoldsService) {
    super();
  }

  /** Throwing lets BullMQ retry with backoff (attempts are set when scheduling). */
  @LogMethod()
  async process({ data }: Job<HoldExpiryJob>): Promise<void> {
    this.logger.debug(data, 'Expiring hold');
    await this.holds.expireHold(data.eventId, data.holdId);
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { LogMethod } from '@org/shared/logger';
import { Job } from 'bullmq';
import { QUEUES } from '../queues/constants';
import { HoldExpiryJob } from './hold-expiry.producer';
import { HoldsService } from './holds.service';

@Processor(QUEUES.holdExpiry)
export class HoldExpiryProcessor extends WorkerHost {
  constructor(private readonly holds: HoldsService) {
    super();
  }

  /** Throwing lets BullMQ retry with backoff (attempts are set when scheduling). */
  @LogMethod()
  async process({ data }: Job<HoldExpiryJob>): Promise<void> {
    await this.holds.expireHold(data.eventId, data.holdId);
  }
}

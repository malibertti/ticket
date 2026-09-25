import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { DEDUP, JOBS, QUEUES, type JobContext } from './constants';

@Injectable()
export class ReindexProducer {
  constructor(@InjectQueue(QUEUES.search) private readonly queue: Queue) {}

  async enqueue(ctx: JobContext) {
    const jobRunningId = await this.isRunning();

    if (jobRunningId) {
      return {
        jobId: jobRunningId,
        alreadyRunning: true,
      };
    }

    const job = await this.queue.add(JOBS.reindex, ctx, {
      deduplication: { id: DEDUP.reindex },
      attempts: 1,
    });

    return {
      jobId: job.id,
    };
  }

  find(id: string) {
    return this.queue.getJob(id);
  }

  isRunning() {
    return this.queue.getDeduplicationJobId(DEDUP.reindex);
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUES } from '../queues/constants';
import { PgClient } from './constants';
import { seedDb } from './seed';

@Processor(QUEUES.seed, {
  concurrency: 1,
})
export class SeedProcessor extends WorkerHost {
  constructor(private readonly pg: PgClient) {
    super();
  }

  process(job: Job) {
    return seedDb(this.pg, (progress) => {
      job.updateProgress(progress);
    });
  }
}

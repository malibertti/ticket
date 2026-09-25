import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '../queues/constants';
import { type Database, DB_CONNECTION } from './constants';
import { seedDb } from './seed';

@Processor(QUEUES.seed, {
  concurrency: 1,
})
export class SeedProcessor extends WorkerHost {
  constructor(@Inject(DB_CONNECTION) private readonly db: Database) {
    super();
  }

  process(job: Job) {
    return seedDb(this.db, (progress) => {
      job.updateProgress(progress);
    });
  }
}

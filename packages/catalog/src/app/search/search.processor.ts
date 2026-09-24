import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { REINDEX_JOB, SEARCH_QUEUE } from './constants';
import { ReindexService } from './reindex.service';

@Processor(SEARCH_QUEUE, {
  concurrency: 1,
})
export class SearchProcessor extends WorkerHost {
  constructor(private readonly reindex: ReindexService) {
    super();
  }

  async process(job: Job) {
    switch (job.name) {
      case REINDEX_JOB:
        return this.reindex.run((processed) => job.updateProgress(processed));
      default:
        throw new Error(`Unknown job ${job.name}`);
    }
  }
}

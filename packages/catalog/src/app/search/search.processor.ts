import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { REINDEX_JOB, SEARCH_QUEUE } from './constants';
import { ReindexService } from './reindex.service';

@Processor(SEARCH_QUEUE, {
  concurrency: 1,
})
export class SearchProcessor extends WorkerHost {
  private readonly logger = new Logger(SearchProcessor.name);

  constructor(private readonly reindex: ReindexService) {
    super();
  }

  async process(job: Job) {
    const ctx = {
      jobId: job.id,
      requestId: job.data.requestId,
    };

    switch (job.name) {
      case REINDEX_JOB: {
        this.logger.log(ctx, 'reindex started');
        const res = await this.reindex.run((processed) =>
          job.updateProgress(processed),
        );
        this.logger.log({ ctx, res }, 'reindex completed');

        return res;
      }
      default:
        throw new Error(`Unknown job ${job.name}`);
    }
  }
}

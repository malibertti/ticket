import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { REINDEX_JOB, SEARCH_QUEUE } from './constants';
import { ReindexService } from './reindex.service';

@Processor(SEARCH_QUEUE, {
  concurrency: 1,
})
export class SearchProcessor extends WorkerHost {
  constructor(
    private readonly reindex: ReindexService,
    @InjectPinoLogger(SearchProcessor.name) private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job) {
    const ctx = { jobId: job.id, requestId: job.data.requestId };

    switch (job.name) {
      case REINDEX_JOB: {
        this.logger.info(ctx, 'reindex started');
        const res = await this.reindex.run((processed) =>
          job.updateProgress(processed),
        );
        this.logger.info({ ...ctx, ...res }, 'reindex finished');

        return res;
      }
      default:
        throw new Error(`Unknown job ${job.name}`);
    }
  }
}

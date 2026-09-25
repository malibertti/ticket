import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUES } from '../queues/constants';
import { ReindexService } from './reindex.service';

@Processor(QUEUES.search, {
  concurrency: 1,
})
export class SearchProcessor extends WorkerHost {
  constructor(private readonly reindex: ReindexService) {
    super();
  }

  process(job: Job) {
    return this.reindex.run((processed) => {
      job.updateProgress(processed);
    });
  }
}

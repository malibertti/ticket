import { InjectFlowProducer, InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { FlowProducer, Queue } from 'bullmq';
import { FLOWS, JobContext, JOBS, QUEUES } from './constants';

@Injectable()
export class SeedProducer {
  constructor(
    @InjectQueue(QUEUES.seed) private readonly queue: Queue,
    @InjectFlowProducer(FLOWS.seedThenReindex)
    private readonly flow: FlowProducer,
  ) {}

  async enqueue(ctx: JobContext) {
    const jobRunningId = await this.isRunning();

    if (jobRunningId) {
      return {
        jobId: jobRunningId,
        alreadyRunning: true,
      };
    }

    // Seed Postgres, then index in OpenSearch.
    const node = await this.flow.add({
      name: JOBS.reindex,
      queueName: QUEUES.search,
      data: ctx,
      children: [
        {
          name: JOBS.seed,
          queueName: QUEUES.seed,
          data: ctx,
          opts: {
            attempts: 1,
            failParentOnFailure: true,
          },
        },
      ],
    });

    return {
      jobId: node.children?.[0].job.id,
      reindexJobId: node.job.id!,
    };
  }

  find(id: string) {
    return this.queue.getJob(id);
  }

  async isRunning(): Promise<string | null> {
    const [job] = await this.queue.getJobs(
      ['active', 'waiting', 'delayed', 'waiting-children'],
      0,
      0,
    );
    return job?.id ?? null;
  }
}

import { InjectFlowProducer, InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { FlowProducer, Queue } from 'bullmq';
import { DEDUP, FLOWS, JOBS, QUEUES, type JobContext } from './constants';

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

import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { Roles } from '../auth/roles.decorator';
import { REINDEX_DEDUP_ID, REINDEX_JOB, SEARCH_QUEUE } from './constants';
import type { ReindexResult } from './reindex.service';

// type ReindexJob = Job<Record<string, never>, ReindexResult>;
type ReindexJob = Job<{ requestId?: string }, ReindexResult>;

@Roles(['admins'])
@Controller('search/reindex')
export class ReindexController {
  constructor(@InjectQueue(SEARCH_QUEUE) private readonly queue: Queue) {}

  @Post()
  @HttpCode(202)
  async start(@Req() req: Request & { id: string }) {
    const runningId = await this.queue.getDeduplicationJobId(REINDEX_DEDUP_ID);

    if (runningId) {
      throw new ConflictException({
        message: 'Reindex already running',
        jobId: runningId,
      });
    }

    const job = await this.queue.add(
      REINDEX_JOB,
      { requestId: req.id },
      {
        deduplication: { id: REINDEX_DEDUP_ID },
        attempts: 1,
      },
    );

    return {
      jobId: job.id,
    };
  }

  @Get(':id')
  async status(@Param('id') id: string) {
    const job = (await this.queue.getJob(id)) as ReindexJob | undefined;
    if (!job || job.name !== REINDEX_JOB) {
      throw new NotFoundException(`Reindex job ${id} not found`);
    }

    return {
      id: job.id,
      state: await job.getState(),
      progress: job.progress,
      result: job.returnvalue ?? null,
      failedReason: job.failedReason ?? null,
      createdAt: new Date(job.timestamp).toISOString(),
      finishedAt: job.finishedOn
        ? new Date(job.finishedOn).toISOString()
        : null,
    };
  }
}

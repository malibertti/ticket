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
import { Roles } from '@org/shared/auth';
import { ReindexProducer } from '../queues/reindex.producer';
import { SeedProducer } from '../queues/seed.producer';
import { DbService } from './db.service';

@Controller('db')
export class DbController {
  constructor(
    private readonly dbs: DbService,
    private readonly seedProducer: SeedProducer,
    private readonly reindexProducer: ReindexProducer,
  ) {}

  @Post('seed')
  @Roles(['admins'])
  @HttpCode(202)
  async seed(@Req() req: Request & { id: string }) {
    const res = await this.seedProducer.enqueue({
      requestId: req.id,
    });

    if (res.alreadyRunning) {
      throw new ConflictException({
        message: 'Reindex queue already running',
        jobId: res.jobId,
      });
    }

    return res;
  }

  @Get('seed/:id')
  @Roles(['admins'])
  async status(@Param('id') id: string) {
    const job = await this.seedProducer.find(id);

    if (!job) {
      throw new NotFoundException(`Seed job ${id} not found`);
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

  @Post('truncate')
  @Roles(['admins'])
  async truncate(@Req() req: Request & { id: string }) {
    const seedJobId = await this.seedProducer.isRunning();

    if (seedJobId) {
      throw new ConflictException({
        message: 'Seed in progress',
        jobId: seedJobId,
      });
    }

    await this.dbs.truncate();

    const { jobId } = await this.reindexProducer.enqueue({ requestId: req.id });

    return {
      truncated: true,
      reindexJobId: jobId,
    };
  }
}

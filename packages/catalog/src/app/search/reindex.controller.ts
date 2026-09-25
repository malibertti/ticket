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
import { Roles } from '../auth/roles.decorator';
import { ReindexProducer } from '../queues/ReindexProducer';

@Roles(['admins'])
@Controller('search/reindex')
export class ReindexController {
  constructor(private readonly producer: ReindexProducer) {}

  @Post()
  @HttpCode(202)
  async reindex(@Req() req: Request & { id: string }) {
    const res = await this.producer.enqueue({
      requestId: req.id,
    });

    if (res.alreadyRunning) {
      throw new ConflictException({
        message: 'Seed queue already running',
        jobId: res.jobId,
      });
    }

    return res;
  }

  @Get(':id')
  async status(@Param('id') id: string) {
    const job = await this.producer.find(id);

    if (!job) {
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

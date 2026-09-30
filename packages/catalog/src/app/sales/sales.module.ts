import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { EnvModule } from '../env/env.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [DbModule, EnvModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}

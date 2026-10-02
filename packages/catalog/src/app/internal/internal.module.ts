import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';

@Module({
  imports: [DbModule],
  providers: [InternalService],
  controllers: [InternalController],
})
export class InternalModule {}

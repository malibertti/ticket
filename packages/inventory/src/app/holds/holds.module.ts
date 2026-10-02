import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { HoldsController } from './holds.controller';
import { HoldsService } from './holds.service';

@Module({
  imports: [DbModule],
  controllers: [HoldsController],
  providers: [HoldsService],
})
export class HoldsModule {}

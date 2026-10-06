import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { QueuesModule } from '../queues/queues.module';
import { HoldExpiryProcessor } from './hold-expiry.processor';
import { HoldExpiryProducer } from './hold-expiry.producer';
import { HoldsController } from './holds.controller';
import { HoldsService } from './holds.service';

@Module({
  imports: [DbModule, QueuesModule],
  controllers: [HoldsController],
  providers: [HoldsService, HoldExpiryProducer, HoldExpiryProcessor],
})
export class HoldsModule {}

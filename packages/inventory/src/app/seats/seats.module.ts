import { Module } from '@nestjs/common';
import { EventStoreModule } from '../event-store/event-store.module';
import { QueuesModule } from '../queues/queues.module';
import { SellableSeatsModule } from '../sellable-seats/sellable-seats.module';
import { HoldsController } from './holds.controller';
import { SeatsService } from './seats.service';

@Module({
  imports: [EventStoreModule, SellableSeatsModule, QueuesModule],
  controllers: [HoldsController],
  providers: [SeatsService],
})
export class SeatsModule {}

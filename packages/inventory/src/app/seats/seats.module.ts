import { Module } from '@nestjs/common';
import { EventStoreModule } from '../event-store/event-store.module';
import { HoldsController } from './holds.controller';
import { SeatsService } from './seats.service';

@Module({
  imports: [EventStoreModule],
  controllers: [HoldsController],
  providers: [SeatsService],
})
export class SeatsModule {}

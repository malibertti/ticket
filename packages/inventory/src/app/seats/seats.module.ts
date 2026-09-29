import { Module } from '@nestjs/common';
import { Clock, SystemClock } from '../common/clock';
import { EventStoreModule } from '../event-store/event-store.module';
import { SeatCommandsService } from './application/seat-commands.service';
import { HoldsController } from './http/holds.controller';

@Module({
  imports: [EventStoreModule],
  controllers: [HoldsController],
  providers: [
    {
      provide: Clock,
      useClass: SystemClock,
    },
    SeatCommandsService,
  ],
})
export class SeatsModule {}

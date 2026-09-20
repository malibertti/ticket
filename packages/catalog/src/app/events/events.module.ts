import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [DbModule],
  providers: [EventsService],
  controllers: [EventsController],
})
export class EventsModule {}

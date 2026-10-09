import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { OutboxModule } from '../outbox/outbox.module';
import { EventController } from './event.controller';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [DbModule, OutboxModule],
  providers: [EventsService],
  controllers: [EventsController, EventController],
})
export class EventsModule {}

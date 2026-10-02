import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { SearchModule } from '../search/search.module';
import { EventController } from './event.controller';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { InventoryService } from './inventory.service';

@Module({
  imports: [DbModule, SearchModule],
  providers: [EventsService, InventoryService],
  controllers: [EventsController, EventController],
})
export class EventsModule {}

import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SearchModule } from '../search/search.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [DbModule, SearchModule, InventoryModule],
  providers: [EventsService],
  controllers: [EventsController],
})
export class EventsModule {}

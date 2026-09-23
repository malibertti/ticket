import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { SearchModule } from '../search/search.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [DbModule, SearchModule],
  providers: [EventsService],
  controllers: [EventsController],
})
export class EventsModule {}

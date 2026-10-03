import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { SearchModule } from '../search/search.module';
import { EventController } from './event.controller';
import { EventsController } from './events.controller';
import { EventsManifest } from './events.manifest';
import { EventsService } from './events.service';

@Module({
  imports: [DbModule, SearchModule],
  providers: [EventsService, EventsManifest],
  controllers: [EventsController, EventController],
})
export class EventsModule {}

import { Module } from '@nestjs/common';
import { DynamoDbModule } from '../dynamo-db/dynamo-db.module';
import { EventStoreService } from './event-store.service';

@Module({
  imports: [DynamoDbModule],
  providers: [EventStoreService],
  exports: [EventStoreService],
})
export class EventStoreModule {}

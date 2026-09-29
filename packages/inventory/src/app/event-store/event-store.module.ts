import { Module } from '@nestjs/common';
import { DynamoDbModule } from '../dynamo-db/dynamo-db.module';
import { DynamoDbEventStore } from './dynamodb-event-store';
import { EventStore } from './event-store.port';

@Module({
  imports: [DynamoDbModule],
  providers: [
    {
      provide: EventStore,
      useClass: DynamoDbEventStore,
    },
  ],
  exports: [EventStore],
})
export class EventStoreModule {}

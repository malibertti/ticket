import { Module } from '@nestjs/common';
import { DynamoDbModule } from '../dynamo-db/dynamo-db.module';
import { CatalogService } from './catalog.service';
import { InternalController } from './internal.controller';
import { SellableSeatsService } from './sellable-seats.service';
import { SyncService } from './sync.service';

@Module({
  imports: [DynamoDbModule],
  controllers: [InternalController],
  providers: [SellableSeatsService, CatalogService, SyncService],
  exports: [SellableSeatsService],
})
export class SellableSeatsModule {}

import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { CatalogService } from './catalog.service';
import { InternalController } from './internal.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [DbModule],
  providers: [SyncService, CatalogService],
  controllers: [InternalController],
})
export class InternalModule {}

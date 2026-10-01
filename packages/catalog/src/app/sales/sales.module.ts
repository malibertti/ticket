import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { EnvModule } from '../env/env.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SearchModule } from '../search/search.module';
import { InternalController } from './internal.controller';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [DbModule, EnvModule, InventoryModule, SearchModule],
  controllers: [SalesController, InternalController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}

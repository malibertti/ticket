import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { SeatMapConsumer } from './seat-map.consumer';
import { SeatMapController } from './seat-map.controller';

@Module({
  imports: [DbModule],
  controllers: [SeatMapController],
  providers: [SeatMapConsumer],
})
export class SeatMapModule {}

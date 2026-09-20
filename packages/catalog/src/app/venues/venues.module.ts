import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { VenuesController } from './venues.controller';
import { VenuesService } from './venues.service';

@Module({
  imports: [DbModule],
  providers: [VenuesService],
  controllers: [VenuesController],
})
export class VenuesModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { schema } from '../env';
import { DbModule } from './db/db.module';
import { EventsModule } from './events/events.module';
import { OpsModule } from './ops/ops.module';
import { VenuesModule } from './venues/venues.module';

export const ENV = Symbol('ENV');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: schema,
    }),
    DbModule,
    EventsModule,
    VenuesModule,
    OpsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { schema } from '../env';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { EventsModule } from './events/events.module';
import { LoggerModule } from './logger/logger.module';
import { OpsModule } from './ops/ops.module';
import { QueuesModule } from './queues/queues.module';
import { SearchModule } from './search/search.module';
import { VenuesModule } from './venues/venues.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: schema.parse,
    }),
    DbModule,
    AuthModule,
    OpsModule,
    EventsModule,
    VenuesModule,
    SearchModule,
    LoggerModule,
    QueuesModule,
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/shared/auth';
import { HealthModule } from '@org/shared/health';
import { LoggerModule } from '@org/shared/logger';
import { schema } from '../env';
import { DbModule } from './db/db.module';
import { EventsModule } from './events/events.module';
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
    LoggerModule.forRoot('catalog'),
    DbModule,
    AuthModule,
    HealthModule,
    EventsModule,
    VenuesModule,
    SearchModule,
    LoggerModule,
    QueuesModule,
  ],
})
export class AppModule {}

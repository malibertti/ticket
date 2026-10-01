import { Module } from '@nestjs/common';
import { AuthModule } from '@org/shared/auth';
import { HealthModule } from '@org/shared/health';
import { LoggerModule } from '@org/shared/logger';
import { DbModule } from './db/db.module';
import { EnvModule } from './env/env.module';
import { EventsModule } from './events/events.module';
import { QueuesModule } from './queues/queues.module';
import { SalesModule } from './sales/sales.module';
import { SearchModule } from './search/search.module';
import { VenuesModule } from './venues/venues.module';

@Module({
  imports: [
    EnvModule,
    LoggerModule.forRoot('catalog'),
    DbModule,
    AuthModule,
    HealthModule,
    EventsModule,
    VenuesModule,
    SearchModule,
    QueuesModule,
    SalesModule,
  ],
  controllers: [],
})
export class AppModule {}

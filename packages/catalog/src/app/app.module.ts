import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { schema } from '../env';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { RolesGuard } from './auth/roles.guard';
import { verifierProvider } from './auth/verifier.provider';
import { DbModule } from './db/db.module';
import { EventsModule } from './events/events.module';
import { LoggerModule } from './logger/logger.module';
import { OpsModule } from './ops/ops.module';
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
  ],
  controllers: [],
  providers: [
    verifierProvider, //
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

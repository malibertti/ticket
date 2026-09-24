import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { schema } from '../env';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { RolesGuard } from './auth/roles.guard';
import { verifierProvider } from './auth/verifier.provider';
import { DbModule } from './db/db.module';
import { EventsModule } from './events/events.module';
import { loggerConfigFactory } from './logger.config';
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
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: loggerConfigFactory,
    }),
    DbModule,
    AuthModule,
    OpsModule,
    EventsModule,
    VenuesModule,
    SearchModule,
  ],
  controllers: [],
  providers: [
    verifierProvider, //
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

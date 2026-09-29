import { Module } from '@nestjs/common';
import { HealthModule } from '@org/shared/health';
import { LoggerModule } from '@org/shared/logger';
import { EnvModule } from './env/env.module';
import { SeatsModule } from './seats/seats.module';

@Module({
  imports: [
    EnvModule, //
    LoggerModule.forRoot('inventory'),
    HealthModule,
    SeatsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '@org/shared/auth';
import { HealthModule } from '@org/shared/health';
import { LoggerModule } from '@org/shared/logger';
import { EnvModule } from './env/env.module';
import { HoldsModule } from './holds/holds.module';

@Module({
  imports: [
    EnvModule,
    LoggerModule.forRoot('inventory'),
    AuthModule,
    HealthModule,
    HoldsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

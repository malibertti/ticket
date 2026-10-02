import { Module } from '@nestjs/common';
import { HealthModule } from '@org/shared/health';
import { LoggerModule } from '@org/shared/logger';
import { EnvModule } from './env/env.module';
import { HoldsModule } from './holds/holds.module';
import { InternalModule } from './internal/internal.module';

@Module({
  imports: [
    EnvModule,
    LoggerModule.forRoot('inventory'),
    HealthModule,
    HoldsModule,
    InternalModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

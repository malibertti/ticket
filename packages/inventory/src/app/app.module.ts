import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/shared/auth';
import { HealthModule } from '@org/shared/health';
import { LoggerModule } from '@org/shared/logger';
import { schema } from '../env';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: schema.parse,
    }),
    LoggerModule.forRoot('inventory'),
    AuthModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

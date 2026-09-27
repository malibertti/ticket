import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '@org/shared';
import { schema } from '../env';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: schema.parse,
    }),
    LoggerModule.forRoot('inventory'),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

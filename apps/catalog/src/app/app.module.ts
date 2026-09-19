import { Module } from '@nestjs/common';
import { env } from '@org/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

export const ENV = Symbol('ENV');

@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: ENV,
      useValue: env,
    },
  ],
})
export class AppModule {}

import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { schema } from './env';
import { EnvService } from './env.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: schema.parse,
    }),
  ],
  providers: [EnvService],
  exports: [EnvService],
})
export class EnvModule {}

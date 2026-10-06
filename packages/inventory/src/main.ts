import './instrumentation'; // must be first: instruments everything imported after it

import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@org/shared/logger';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const cs = app.get(ConfigService);
  const logger = app.get(Logger);

  app.useLogger(app.get(Logger));
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.enableShutdownHooks();
  app.enableCors({
    origin: cs.get('CORS_ORIGINS').split(','),
    maxAge: 86400,
  });

  const port = cs.getOrThrow('PORT');
  await app.listen(port);
  logger.log(`🚀 Application is running on: http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});

process.on('disconnect', () => {
  process.exit(0);
});

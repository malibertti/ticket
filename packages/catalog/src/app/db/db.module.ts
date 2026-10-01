import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { relations } from '@org/catalog-schema/schema';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { EnvService } from '../env/env.service.js';
import { QueuesModule } from '../queues/queues.module.js';
import { DB_CONNECTION, DB_POOL } from './constants.js';
import { DbController } from './db.controller.js';
import { DbService } from './db.service.js';
import { SeedProcessor } from './seed.processor.js';

@Module({
  providers: [
    {
      provide: DB_POOL,
      inject: [ConfigService],
      useFactory(env: EnvService) {
        return new Pool({
          host: env.get('DB_HOST'),
          port: env.get('DB_PORT'),
          user: env.get('DB_USER'),
          password: env.get('DB_PASSWORD'),
          database: env.get('DB_NAME'),
          max: env.get('DB_POOL_MAX'),
          idleTimeoutMillis: env.get('DB_IDLE_TIMEOUT_MS'),
          ssl: env.get('DB_SSL') ? { rejectUnauthorized: false } : false,
        });
      },
    },
    {
      provide: DB_CONNECTION,
      inject: [DB_POOL],
      useFactory(pool: Pool) {
        return drizzle({
          client: pool,
          relations,
        });
      },
    },
    DbService,
    SeedProcessor,
  ],
  imports: [QueuesModule],
  exports: [DB_CONNECTION],
  controllers: [DbController],
})
export class DbModule implements OnModuleDestroy {
  constructor(
    @Inject(DB_POOL)
    private readonly pool: Pool,
  ) {}

  async onModuleDestroy() {
    await Promise.race([
      this.pool.end(),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
  }
}

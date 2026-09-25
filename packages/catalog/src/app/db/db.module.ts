import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { QueuesModule } from '../queues/queues.module.js';
import { DB_CONNECTION, DB_POOL } from './constants.js';
import { DbController } from './db.controller.js';
import { DbService } from './db.service.js';
import { relations } from './relations.js';
import { SeedProcessor } from './seed.processor.js';

@Module({
  providers: [
    {
      provide: DB_POOL,
      inject: [ConfigService],
      useFactory(cs: ConfigService) {
        return new Pool({
          host: cs.get('DB_HOST'),
          port: cs.get('DB_PORT'),
          user: cs.get('DB_USER'),
          password: cs.get('DB_PASSWORD'),
          database: cs.get('DB_NAME'),
          max: cs.get('DB_POOL_MAX'),
          idleTimeoutMillis: cs.get('DB_IDLE_TIMEOUT_MS'),
          ssl: cs.get('DB_SSL') ? { rejectUnauthorized: false } : false,
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

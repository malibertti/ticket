import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DB_CONNECTION, DB_POOL } from './constants.js';
import { DbController } from './db.controller.js';
import { DbService } from './db.service.js';
import { relations } from './relations.js';

@Module({
  providers: [
    {
      provide: DB_POOL,
      inject: [ConfigService],
      useFactory(cs: ConfigService) {
        return new Pool({
          connectionString: cs.get('DB_URL'),
          max: cs.get('DB_POOL_MAX'),
          idleTimeoutMillis: cs.get('DB_IDLE_TIMEOUT_MS'),
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
  ],
  exports: [DB_CONNECTION],
  controllers: [DbController],
})
export class DbModule implements OnModuleDestroy {
  constructor(
    @Inject(DB_POOL)
    private readonly pool: Pool,
  ) {}

  async onModuleDestroy() {
    await this.pool.end();
  }
}

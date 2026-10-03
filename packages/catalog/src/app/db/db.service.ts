import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { PgClient } from './constants';

@Injectable()
export class DbService {
  constructor(private readonly pg: PgClient) {}

  truncate() {
    return this.pg.execute(
      sql`TRUNCATE TABLE "catalog"."event_prices", "catalog"."events", "catalog"."venues" CASCADE`,
    );
  }
}

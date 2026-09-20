import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { type Database, DB_CONNECTION } from './constants';
import { seedDb } from './seed';

@Injectable()
export class DbService {
  constructor(@Inject(DB_CONNECTION) private readonly db: Database) {}

  async seed() {
    return seedDb(this.db);
  }

  truncate() {
    return this.db.execute(sql`
      TRUNCATE TABLE events, seat_map_entries, venues CASCADE
    `);
  }
}

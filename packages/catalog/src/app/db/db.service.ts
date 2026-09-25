import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { type Database, DB_CONNECTION } from './constants';

@Injectable()
export class DbService {
  constructor(@Inject(DB_CONNECTION) private readonly db: Database) {}

  truncate() {
    return this.db.execute(sql`
      TRUNCATE TABLE events, seat_map_entries, venues CASCADE
    `);
  }
}

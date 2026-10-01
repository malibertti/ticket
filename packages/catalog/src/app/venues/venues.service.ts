import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { venues } from '@org/catalog-schema/schema';
import { Page, PageQuery } from '@org/catalog-schema/types';
import { desc, eq, sql } from 'drizzle-orm';
import { type Database, DB_CONNECTION } from '../db/constants';

@Injectable()
export class VenuesService {
  constructor(@Inject(DB_CONNECTION) private readonly db: Database) {}

  async getVenues({ page, limit }: PageQuery): Promise<Page<any>> {
    const offset = (page - 1) * limit;

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(venues)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(venues.createdAt)),
      this.db.select({ count: sql<number>`count(*)::int` }).from(venues),
    ]);

    return {
      items: rows,
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    };
  }

  async getVenue(id: string) {
    const [row] = await this.db.select().from(venues).where(eq(venues.id, id));

    if (!row) {
      throw new NotFoundException(`Venue ${id} not found`);
    }

    return row;
  }
}

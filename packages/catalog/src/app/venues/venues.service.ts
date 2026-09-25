import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type Page, type PageQuery } from '@org/contracts';
import { desc, eq, sql } from 'drizzle-orm';
import { type Database, DB_CONNECTION } from '../db/constants';
import { seatMapEntries, venues } from '../db/schema';

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

  async seatMap(id: string) {
    const rows = await this.db
      .select({
        section: seatMapEntries.section,
        rowLabel: seatMapEntries.rowLabel,
        seatNumber: seatMapEntries.seatNumber,
      })
      .from(seatMapEntries)
      .where(eq(seatMapEntries.venueId, id))
      .orderBy(
        seatMapEntries.section,
        sql`length(${seatMapEntries.rowLabel})`,
        seatMapEntries.rowLabel,
        seatMapEntries.seatNumber,
      );

    // group flat rows into sections → rows → seats
    const sections = new Map<string, Map<string, number[]>>();

    for (const r of rows) {
      if (!sections.has(r.section)) {
        sections.set(r.section, new Map());
      }

      const rowsMap = sections.get(r.section)!;

      if (!rowsMap.has(r.rowLabel)) {
        rowsMap.set(r.rowLabel, []);
      }

      rowsMap.get(r.rowLabel)!.push(r.seatNumber);
    }

    return {
      id,
      sections: [...sections].map(([name, rowsMap]) => ({
        name,
        rows: [...rowsMap].map(([label, seats]) => ({ label, seats })),
      })),
    };
  }
}

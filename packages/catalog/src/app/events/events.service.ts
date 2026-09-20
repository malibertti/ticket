import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Page, PageQuery } from '@org/contracts';
import { eq, sql } from 'drizzle-orm';
import { type Database, DB_CONNECTION } from '../db/constants';
import { events } from '../db/schema';

@Injectable()
export class EventsService {
  constructor(@Inject(DB_CONNECTION) private readonly db: Database) {}

  async getEvents({ page, limit }: PageQuery): Promise<Page<any>> {
    const offset = (page - 1) * limit;

    const [rows, [{ count }]] = await Promise.all([
      this.db.select().from(events).limit(limit).offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(events),
    ]);

    return {
      items: rows,
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    };
  }

  async getEvent(id: string) {
    const [row] = await this.db.select().from(events).where(eq(events.id, id));

    if (!row) {
      throw new NotFoundException('Event not found');
    }

    return row;
  }
}

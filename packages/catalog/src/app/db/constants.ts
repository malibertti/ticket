import { relations } from '@org/catalog-schema/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

export abstract class PgClient extends NodePgDatabase<typeof relations> {
  //
}

import { relations } from '@org/catalog-schema/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

export abstract class PgClient extends NodePgDatabase<typeof relations> {
  //
}

/** The transaction object passed to pg.transaction(async (tx) => ...). */
export type PgTransaction = Parameters<
  Parameters<PgClient['transaction']>[0]
>[0];

import { relations } from '@org/catalog-schema/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export const DB_POOL = Symbol('DB_POOL');
export const DB_CONNECTION = Symbol('DB');

export type Database = NodePgDatabase<typeof relations> & {
  $client: Pool;
};

import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { relations } from './relations';

export const DB_POOL = Symbol('DB_POOL');
export const DB_CONNECTION = Symbol('DB');

export type Database = NodePgDatabase<typeof relations> & {
  $client: Pool;
};

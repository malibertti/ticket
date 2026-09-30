/// <reference types="node" />

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/app/db/schema/index.ts',
  out: './src/assets/migrations',
  migrations: {
    table: '__drizzle_migrations_catalog',
  },
  dbCredentials: {
    host: process.env.DB_HOST!,
    port: +process.env.DB_PORT!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  },
});

/// <reference types="node" />

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/app/db/schema.ts',
  out: './src/assets/migrations',
  dbCredentials: {
    url: process.env.DB_URL!,
  },
});

import { z } from 'zod';

export const schema = z.object({
  PORT: z.coerce.number(),
  CORS_ORIGINS: z.string(),

  AWS_REGION: z.string().optional(),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  LOG_PRETTY: z.stringbool().optional().default(false),

  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_HOST: z.string(),
  DB_PORT: z.coerce.number(),
  DB_NAME: z.string(),
  DB_POOL_MAX: z.coerce.number(),
  DB_IDLE_TIMEOUT_MS: z.coerce.number(),
  DB_SSL: z.stringbool().optional(),

  COGNITO_POOL_ID: z.string(),
  COGNITO_CLIENT_ID: z.string(),

  OPENSEARCH_URL: z.url(),
  OPENSEARCH_AUTH: z.enum(['none', 'aws']).default('none'),
  OPENSEARCH_REPLICAS: z.coerce.number().int().min(0).default(0),

  VALKEY_QUEUE_URL: z.string(),

  INVENTORY_BASE_URL: z.url().optional(),
});

export type Env = z.infer<typeof schema>;

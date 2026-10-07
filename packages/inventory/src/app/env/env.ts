import { z } from 'zod';

export const schema = z.object({
  PORT: z.coerce.number(),
  CORS_ORIGINS: z.string(),

  AWS_REGION: z.string(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  LOG_PRETTY: z.stringbool().optional().default(false),

  DYNAMODB_LOCAL_ENDPOINT: z.string().optional(),
  INVENTORY_EVENTS_TABLE: z.string(),
  INVENTORY_COUNTERS_TABLE: z.string(),

  COGNITO_POOL_ID: z.string(),
  COGNITO_CLIENT_ID: z.string(),

  VALKEY_URL: z.string(),

  KAFKA_BROKERS: z.string(),
  SCHEMA_REGISTRY_URL: z.url(),
});

export type Env = z.infer<typeof schema>;

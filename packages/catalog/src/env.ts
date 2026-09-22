import { z } from 'zod';

export const schema = z.object({
  PORT: z.coerce.number(),
  CORS_ORIGINS: z.string(),

  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_HOST: z.string(),
  DB_PORT: z.coerce.number(),
  DB_NAME: z.string(),
  DB_POOL_MAX: z.coerce.number(),
  DB_IDLE_TIMEOUT_MS: z.coerce.number(),
  DB_SSL: z.string().optional(),

  COGNITO_POOL_ID: z.string(),
  COGNITO_CLIENT_ID: z.string(),
});

export type Env = z.infer<typeof schema>;

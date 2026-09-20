import { z } from 'zod';

export const schema = z.object({
  PORT: z.coerce.number().default(300),
  DB_URL: z.string(),
  BD_POOL_MAX: z.coerce.number(),
  DB_IDLE_TIMEOUT_MS: z.coerce.number(),
});

export type Env = z.infer<typeof schema>;

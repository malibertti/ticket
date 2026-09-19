import { z } from 'zod';

const schema = z.object({
  AWS_REGION: z.string(),
  DATABASE_URL: z.url(),
  VALKEY_URL: z.url(),
  S3_ASSETS_BUCKET: z.string(),
  DYNAMO_TICKETS_TABLE: z.string(),
  HOLD_TTL_SECONDS: z.coerce.number().default(300),
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);

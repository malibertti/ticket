import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';

const sm = new SecretsManagerClient();

export async function handler() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: await getDbPassword(),
    database: process.env.DB_NAME,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log('migrate start');
  console.log(
    JSON.stringify({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      database: process.env.DB_NAME,
      connectionTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: false },
    }),
  );
  const db = drizzle({ client });

  await migrate(db, { migrationsFolder: './migrations' });
  console.log('migrate end');

  // app role
  await client.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app') THEN
      CREATE ROLE app WITH LOGIN;
    END IF;
  END $$;`);
  await client.query('GRANT rds_iam TO app');
  await client.query('GRANT CONNECT ON DATABASE ticketing TO app');
  await client.query('GRANT USAGE ON SCHEMA public TO app');
  await client.query(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app',
  );
  await client.query(
    'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app',
  );
  await client.query(
    `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app`,
  );
  await client.query(
    `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app`,
  );

  // Close
  await client.end();
}

async function getDbPassword(): Promise<string> {
  const res = await sm.send(
    new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN }),
  );
  return JSON.parse(res.SecretString!).password as string;
}

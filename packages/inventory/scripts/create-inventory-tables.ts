/// <reference types="node" />

import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { eventsTableDefinition } from '../src/app/event-store/events-table.definition';

async function main() {
  const endpoint = process.env.DYNAMODB_LOCAL_ENDPOINT;
  const tableName = process.env.INVENTORY_EVENTS_TABLE;

  if (!endpoint)
    throw new Error(
      'DYNAMODB_LOCAL_ENDPOINT is not set; refusing to run against real AWS',
    );

  if (!tableName) {
    throw new Error('INVENTORY_EVENTS_TABLE is not set');
  }

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION!,
    endpoint,
  });

  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    console.log(`Table ${tableName} already exists`);
  } catch (err) {
    if (!(err instanceof ResourceNotFoundException)) throw err;
    await client.send(new CreateTableCommand(eventsTableDefinition(tableName)));
    await waitUntilTableExists(
      { client, maxWaitTime: 30 },
      { TableName: tableName },
    );
    console.log(`Created table ${tableName}`);
  } finally {
    client.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/// <reference types="node" />

import {
  CreateTableCommand,
  CreateTableCommandInput,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';

async function main() {
  const endpoint = process.env.DYNAMODB_LOCAL_ENDPOINT;
  const eventsTable = process.env.INVENTORY_EVENTS_TABLE;

  if (!endpoint)
    throw new Error(
      'DYNAMODB_LOCAL_ENDPOINT is not set; refusing to run against real AWS',
    );

  if (!eventsTable) {
    throw new Error('INVENTORY_EVENTS_TABLE must be set');
  }

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION!,
    endpoint,
  });

  try {
    await createTableIfMissing(client, eventsTableDefinition(eventsTable));
  } finally {
    client.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function createTableIfMissing(
  client: DynamoDBClient,
  definition: CreateTableCommandInput,
) {
  const tableName = definition.TableName!;

  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    console.log(`Table ${tableName} already exists`);
  } catch (err) {
    if (!(err instanceof ResourceNotFoundException)) throw err;
    await client.send(new CreateTableCommand(definition));
    await waitUntilTableExists(
      { client, maxWaitTime: 30 },
      { TableName: tableName },
    );
    console.log(`Created table ${tableName}`);
  }
}

function eventsTableDefinition(eventsTable: string): CreateTableCommandInput {
  return {
    TableName: eventsTable,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'streamId', AttributeType: 'S' },
      { AttributeName: 'version', AttributeType: 'N' },
    ],
    KeySchema: [
      { AttributeName: 'streamId', KeyType: 'HASH' },
      { AttributeName: 'version', KeyType: 'RANGE' },
    ],
    StreamSpecification: {
      StreamEnabled: true,
      StreamViewType: 'NEW_IMAGE',
    },
  };
}

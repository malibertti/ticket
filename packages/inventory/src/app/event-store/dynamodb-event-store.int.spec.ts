import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { EnvService } from '../env/env.service';
import { DynamoDbEventStore } from './dynamodb-event-store';
import { ConcurrencyError } from './event-store.port';
import { eventsTableDefinition } from './events-table.definition';

describe('DynamoDbEventStore (DynamoDB Local)', () => {
  const tableName = `inventory-events-test-${randomUUID()}`;
  const db = new DynamoDBClient({
    region: 'us-east-1',
    endpoint: process.env.DYNAMODB_LOCAL_ENDPOINT,
    credentials: {
      accessKeyId: 'local',
      secretAccessKey: 'local',
    },
  });
  const client = DynamoDBDocumentClient.from(db, {
    marshallOptions: { removeUndefinedValues: true },
  });
  const store = new DynamoDbEventStore(
    client,
    new EnvService(
      new ConfigService({
        INVENTORY_EVENTS_TABLE: tableName,
      }),
    ),
  );

  beforeAll(async () => {
    await db.send(new CreateTableCommand(eventsTableDefinition(tableName)));
    await waitUntilTableExists(
      { client: db, maxWaitTime: 30 },
      { TableName: tableName },
    );
  });

  afterAll(async () => {
    await db.send(new DeleteTableCommand({ TableName: tableName }));
    db.destroy();
  });

  let n = 0;
  const newStream = () => `seat#evt_test#S-${++n}`;
  const held = (holdId: string) => ({
    type: 'SeatHeld',
    holdId,
    expiresAt: '2026-10-01T10:10:00.000Z',
  });

  it('returns [] for a stream that does not exist', async () => {
    expect(await store.readStream(newStream())).toEqual([]);
  });

  it('appends and reads back in order with versions', async () => {
    const s = newStream();
    await store.appendAtomically([
      {
        streamId: s,
        expectedVersion: 0,
        events: [held('h1'), { type: 'HoldExpired', holdId: 'h1' }],
      },
    ]);

    const events = await store.readStream(s);
    expect(events.map((e) => [e.version, e.type])).toEqual([
      [1, 'SeatHeld'],
      [2, 'HoldExpired'],
    ]);
    expect(events[0].data).toEqual(held('h1'));
    expect(events[1].data).toEqual({ type: 'HoldExpired', holdId: 'h1' });
  });

  it('rejects a stale expectedVersion with ConcurrencyError naming the stream', async () => {
    const s = newStream();
    await store.appendAtomically([
      { streamId: s, expectedVersion: 0, events: [held('h1')] },
    ]);

    await expect(
      store.appendAtomically([
        { streamId: s, expectedVersion: 0, events: [held('h2')] },
      ]),
    ).rejects.toMatchObject({ name: 'ConcurrencyError', streamIds: [s] });
  });

  it('lets exactly one of two concurrent appends win', async () => {
    const s = newStream();
    const results = await Promise.allSettled([
      store.appendAtomically([
        { streamId: s, expectedVersion: 0, events: [held('h1')] },
      ]),
      store.appendAtomically([
        { streamId: s, expectedVersion: 0, events: [held('h2')] },
      ]),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(
      (r) => r.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConcurrencyError);
    expect(await store.readStream(s)).toHaveLength(1);
  });

  it('is all-or-nothing across streams', async () => {
    const [a, b] = [newStream(), newStream()];
    await store.appendAtomically([
      { streamId: b, expectedVersion: 0, events: [held('h0')] },
    ]);

    await expect(
      store.appendAtomically([
        { streamId: a, expectedVersion: 0, events: [held('h1')] },
        { streamId: b, expectedVersion: 0, events: [held('h1')] }, // stale
      ]),
    ).rejects.toMatchObject({ streamIds: [b] });

    expect(await store.readStream(a)).toEqual([]); // a was not written either
    expect(await store.readStream(b)).toMatchObject([{ data: held('h0') }]);
  });
});

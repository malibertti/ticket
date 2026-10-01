import {
  DynamoDBDocumentClient,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EnvService } from '../env/env.service';

interface DomainEvent {
  type: string;
}

interface StoredEvent<E extends DomainEvent = DomainEvent> {
  streamId: string;
  version: number;
  eventId: string;
  type: E['type'];
  data: E;
  occurredAt: string;
  metadata: Record<string, string>;
}

interface AppendRequest<E extends DomainEvent = DomainEvent> {
  streamId: string;
  expectedVersion: number; // 0 = stream must not exist yet
  events: E[];
  metadata?: Record<string, string>;
}

export class ConcurrencyError extends Error {
  constructor(readonly streamIds: string[]) {
    super(`Concurrent modification on: ${streamIds.join(', ')}`);
    this.name = 'ConcurrencyError';
  }
}

@Injectable()
export class EventStoreService {
  private readonly logger = new Logger(EventStoreService.name);
  private readonly maxTransactItems = 100;
  private readonly conflictCodes = new Set([
    'ConditionalCheckFailed',
    'TransactionConflict',
  ]);
  private readonly tableName: string;

  constructor(
    private readonly client: DynamoDBDocumentClient,
    readonly env: EnvService,
  ) {
    this.tableName = env.get('INVENTORY_EVENTS_TABLE');
  }

  async readStream<E extends DomainEvent>(
    streamId: string,
  ): Promise<StoredEvent<E>[]> {
    this.logger.debug({ streamId }, 'readStream:start');
    const events: StoredEvent<E>[] = [];
    let startKey: Record<string, unknown> | undefined;

    do {
      const res = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'streamId = :s',
          ExpressionAttributeValues: { ':s': streamId },
          ConsistentRead: true,
          ExclusiveStartKey: startKey,
        }),
      );
      events.push(...((res.Items ?? []) as StoredEvent<E>[]));
      startKey = res.LastEvaluatedKey;
    } while (startKey);

    this.logger.debug({ events, streamId }, 'readStream:complete');
    return events;
  }

  async appendAtomically(requests: AppendRequest[]): Promise<void> {
    this.logger.debug({ requests }, 'appendAtomically');
    const nonEmpty = requests.filter((r) => r.events.length > 0);
    const streamIds = nonEmpty.map((r) => r.streamId);

    if (new Set(streamIds).size !== streamIds.length) {
      throw new Error('Each stream may appear only once per append');
    }

    const occurredAt = new Date().toISOString();
    const items: StoredEvent[] = nonEmpty.flatMap((r) =>
      r.events.map((event, i) => ({
        streamId: r.streamId,
        version: r.expectedVersion + i + 1,
        eventId: randomUUID(),
        type: event.type,
        data: event,
        occurredAt,
        metadata: r.metadata ?? {},
      })),
    );

    if (items.length === 0) return;

    if (items.length > this.maxTransactItems) {
      throw new Error(
        `Append of ${items.length} events exceeds ${this.maxTransactItems}`,
      );
    }

    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: items.map((item) => ({
            Put: {
              TableName: this.tableName,
              Item: item,
              ConditionExpression: 'attribute_not_exists(streamId)',
            },
          })),
        }),
      );
    } catch (err) {
      throw this.toConcurrencyError(err, items) ?? err;
    }
  }

  private toConcurrencyError(
    err: unknown,
    items: StoredEvent[],
  ): ConcurrencyError | undefined {
    if (
      !(err instanceof Error) ||
      err.name !== 'TransactionCanceledException'
    ) {
      return undefined;
    }

    const reasons =
      (err as Error & { CancellationReasons?: { Code?: string }[] })
        .CancellationReasons ?? [];

    const conflicted = reasons
      .map((reason, i) =>
        reason.Code && this.conflictCodes.has(reason.Code)
          ? items[i].streamId
          : null,
      )
      .filter((id): id is string => id !== null);

    return conflicted.length
      ? new ConcurrencyError([...new Set(conflicted)])
      : undefined;
  }
}

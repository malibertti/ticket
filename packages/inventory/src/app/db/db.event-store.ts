import {
  DynamoDBDocumentClient,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { currentTraceContext } from '@org/shared/telemetry';
import { EnvService } from '../env/env.service';

interface DomainEvent {
  type: string;
}

interface StoredEvent<E extends DomainEvent = DomainEvent> {
  streamId: string;
  version: number;
  type: E['type'];
  data: E;
  occurredAt: string;
  traceparent?: string;
}

interface AppendRequest<E extends DomainEvent = DomainEvent> {
  streamId: string;
  expectedVersion: number; // 0 = stream must not exist yet
  events: E[];
}

/** A change to a standing section's counter, applied in the same transaction as the events. */
export interface CounterChange {
  eventId: string;
  section: string;
  delta: number;
  capacity: number;
}

@Injectable()
export class DbEventStore {
  private readonly maxTransactItems = 100;
  private readonly conflictCodes = new Set([
    'ConditionalCheckFailed',
    'TransactionConflict',
  ]);
  private readonly eventsTable: string;
  private readonly countersTable: string;

  constructor(
    private readonly client: DynamoDBDocumentClient,
    readonly env: EnvService,
  ) {
    this.eventsTable = env.get('INVENTORY_EVENTS_TABLE');
    this.countersTable = env.get('INVENTORY_COUNTERS_TABLE');
  }

  async readStream<E extends DomainEvent>(
    streamId: string,
  ): Promise<StoredEvent<E>[]> {
    const events: StoredEvent<E>[] = [];
    let startKey: Record<string, unknown> | undefined;

    do {
      const res = await this.client.send(
        new QueryCommand({
          TableName: this.eventsTable,
          KeyConditionExpression: 'streamId = :s',
          ExpressionAttributeValues: { ':s': streamId },
          ConsistentRead: true,
          ExclusiveStartKey: startKey,
        }),
      );
      events.push(...((res.Items ?? []) as StoredEvent<E>[]));
      startKey = res.LastEvaluatedKey;
    } while (startKey);

    return events;
  }

  async appendAtomically(
    requests: AppendRequest[],
    counters: CounterChange[] = [],
  ): Promise<void> {
    const nonEmpty = requests.filter((r) => r.events.length > 0);
    const streamIds = nonEmpty.map((r) => r.streamId);

    if (new Set(streamIds).size !== streamIds.length) {
      throw new Error('Each stream may appear only once per append');
    }

    const occurredAt = new Date().toISOString();
    const { traceparent } = currentTraceContext();
    const items: StoredEvent[] = nonEmpty.flatMap((r) =>
      r.events.map((event, i) => ({
        streamId: r.streamId,
        version: r.expectedVersion + i + 1,
        type: event.type,
        data: event,
        occurredAt,
        traceparent,
      })),
    );

    if (items.length === 0) return;

    const totalLength = items.length + counters.length;

    if (totalLength > this.maxTransactItems) {
      throw new Error(
        `Append of ${totalLength} items exceeds ${this.maxTransactItems}`,
      );
    }

    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            ...items.map((item) => ({
              Put: {
                TableName: this.eventsTable,
                Item: item,
                ConditionExpression: 'attribute_not_exists(streamId)',
              },
            })),
            ...counters.map((counter) => ({
              Update: this.counterUpdate(counter),
            })),
          ],
        }),
      );
    } catch (err) {
      throw this.toAppendError(err, items, counters) ?? err;
    }
  }

  /**
   * Counts places taken (held or booked) per standing section. Capacity stays in the manifest,
   * so extending or shrinking a section applies to the next hold with nothing to migrate.
   */
  private counterUpdate({ eventId, section, delta, capacity }: CounterChange) {
    const key = { eventId, section };

    if (delta > 0) {
      // taken + delta must not exceed capacity; the first hold creates the counter
      return {
        TableName: this.countersTable,
        Key: key,
        UpdateExpression: 'SET taken = if_not_exists(taken, :zero) + :n',
        ConditionExpression: 'attribute_not_exists(taken) OR taken <= :limit',
        ExpressionAttributeValues: {
          ':zero': 0,
          ':n': delta,
          ':limit': capacity - delta,
        },
      };
    }

    return {
      TableName: this.countersTable,
      Key: key,
      UpdateExpression: 'SET taken = taken - :n',
      ExpressionAttributeValues: { ':n': -delta },
    };
  }

  /** Maps a cancelled transaction to what went wrong, by each item's position in it. */
  private toAppendError(
    err: unknown,
    items: StoredEvent[],
    counters: CounterChange[],
  ): ConcurrencyError | NotEnoughAvailable | undefined {
    if (
      !(err instanceof Error) ||
      err.name !== 'TransactionCanceledException'
    ) {
      return undefined;
    }

    const reasons =
      (err as Error & { CancellationReasons?: { Code?: string }[] })
        .CancellationReasons ?? [];

    // a counter's condition failed: not enough places left in that section
    const shortSections = reasons
      .map((reason, i) =>
        i >= items.length && reason.Code === 'ConditionalCheckFailed'
          ? counters[i - items.length].section
          : null,
      )
      .filter((section): section is string => section !== null);

    if (shortSections.length) {
      return new NotEnoughAvailable(shortSections);
    }

    // anything else conflicting (an event already written, or a concurrent transaction
    // on the same stream or counter) is retryable
    const conflicted = reasons
      .map((reason, i) =>
        reason.Code && this.conflictCodes.has(reason.Code)
          ? (items[i]?.streamId ??
            `counter:${counters[i - items.length].section}`)
          : null,
      )
      .filter((id): id is string => id !== null);

    return conflicted.length
      ? new ConcurrencyError([...new Set(conflicted)])
      : undefined;
  }
}

export class ConcurrencyError extends Error {
  constructor(readonly streamIds: string[]) {
    super(`Concurrent modification on: ${streamIds.join(', ')}`);
    this.name = 'ConcurrencyError';
  }
}

export class NotEnoughAvailable extends Error {
  constructor(readonly sections: string[]) {
    super(`Not enough available in: ${sections.join(', ')}`);
    this.name = 'NotEnoughAvailable';
  }
}

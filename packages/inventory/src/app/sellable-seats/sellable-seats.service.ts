import {
  BatchGetCommand,
  type BatchGetCommandInput,
  type BatchGetCommandOutput,
  BatchWriteCommand,
  type BatchWriteCommandInput,
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import type {
  SellableSeat,
  SellableSeatsSnapshot,
} from '@org/catalog-schema/types';
import { EnvService } from '../env/env.service';

type WriteRequests = NonNullable<
  BatchWriteCommandInput['RequestItems']
>[string];
type GetKeys = NonNullable<
  BatchGetCommandInput['RequestItems']
>[string]['Keys'];

/** Inventory's local copy of what catalog says is sellable: one item per seat or standing slot. */
@Injectable()
export class SellableSeatsService {
  private readonly batchSize = 25; // BatchWriteItem limit
  private readonly parallelBatches = 4;
  private readonly maxAttempts = 5;
  private readonly tableName: string;

  constructor(
    private readonly client: DynamoDBDocumentClient,
    env: EnvService,
  ) {
    this.tableName = env.get('INVENTORY_SELLABLE_SEATS_TABLE');
  }

  /** Overwrites every seat of the snapshot. Layouts are frozen while on sale, so nothing needs deleting. */
  async writeSnapshot({
    eventId,
    layoutVersion,
    seats,
  }: SellableSeatsSnapshot) {
    const syncedAt = new Date().toISOString();
    const items = seats.map((seat) => ({
      eventId,
      layoutVersion,
      syncedAt,
      ...seat,
    }));

    const batches = chunk(items, this.batchSize);

    for (let i = 0; i < batches.length; i += this.parallelBatches) {
      await Promise.all(
        batches
          .slice(i, i + this.parallelBatches)
          .map((batch) => this.writeBatch(batch)),
      );
    }
  }

  /** The requested seats that are sellable, keyed by seatId. Missing ids are simply absent. */
  async findSeats(
    eventId: string,
    seatIds: string[],
  ): Promise<Map<string, SellableSeat>> {
    const found = new Map<string, SellableSeat>();
    let keys: GetKeys = seatIds.map((seatId) => ({ eventId, seatId }));

    for (let attempt = 1; keys?.length; attempt++) {
      if (attempt > this.maxAttempts) {
        throw new Error(
          `Sellable seats lookup for ${eventId} kept being throttled`,
        );
      }

      const res: BatchGetCommandOutput = await this.client.send(
        new BatchGetCommand({
          RequestItems: {
            [this.tableName]: { Keys: keys, ConsistentRead: true },
          },
        }),
      );

      for (const item of res.Responses?.[this.tableName] ?? []) {
        found.set(item.seatId, toSellableSeat(item));
        // found.set(item.seatId, {
        //   seatId: item.seatId,
        //   section: item.section,
        //   standing: item.standing,
        //   priceCents: item.priceCents,
        //   currency: item.currency,
        // });
      }

      keys = res.UnprocessedKeys?.[this.tableName]?.Keys;
      if (keys?.length) await sleep(backoffMs(attempt));
    }

    return found;
  }

  /** Every sellable seat of a section. Seat ids start with the section code, so a prefix query is enough. */
  async findSection(eventId: string, section: string): Promise<SellableSeat[]> {
    const seats: SellableSeat[] = [];
    let startKey: Record<string, unknown> | undefined;

    do {
      const res: QueryCommandOutput = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression:
            'eventId = :eventId AND begins_with(seatId, :prefix)',
          ExpressionAttributeValues: {
            ':eventId': eventId,
            ':prefix': `${section}:`,
          },
          ExclusiveStartKey: startKey,
        }),
      );

      seats.push(...(res.Items ?? []).map(toSellableSeat));
      startKey = res.LastEvaluatedKey;
    } while (startKey);

    return seats;
  }

  private async writeBatch(items: Record<string, unknown>[]) {
    let requests: WriteRequests = items.map((Item) => ({
      PutRequest: { Item },
    }));

    for (let attempt = 1; requests.length; attempt++) {
      if (attempt > this.maxAttempts) {
        throw new Error(`Sellable seats write kept being throttled`);
      }

      const res = await this.client.send(
        new BatchWriteCommand({
          RequestItems: { [this.tableName]: requests },
        }),
      );

      requests = res.UnprocessedItems?.[this.tableName] ?? [];
      if (requests.length) await sleep(backoffMs(attempt));
    }
  }
}

function toSellableSeat(item: Record<string, any>): SellableSeat {
  return {
    seatId: item.seatId,
    section: item.section,
    standing: item.standing,
    priceCents: item.priceCents,
    currency: item.currency,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number) {
  return 50 * 2 ** (attempt - 1) + Math.random() * 50;
}

import { Injectable } from '@nestjs/common';
import { outbox } from '@org/catalog-schema/schema';
import { Topic } from '@org/shared/kafka';
import { PgTransaction } from '../db/constants';

@Injectable()
export class OutboxService {
  /**
   * Queues an event for Kafka. Must be called inside the transaction that makes the change,
   * so the event and the change commit (or roll back) together.
   */
  async write(
    tx: PgTransaction,
    topic: Topic,
    key: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await tx.insert(outbox).values({ topic, key, payload });
  }
}

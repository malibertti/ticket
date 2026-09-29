import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AppendRequest,
  ConcurrencyError,
  DomainEvent,
  EventStore,
  StoredEvent,
} from './event-store.port';

@Injectable()
export class InMemoryEventStore implements EventStore {
  private readonly streams = new Map<string, StoredEvent[]>();

  async readStream<E extends DomainEvent>(
    streamId: string,
  ): Promise<StoredEvent<E>[]> {
    return [...(this.streams.get(streamId) ?? [])] as StoredEvent<E>[];
  }

  async appendAtomically(requests: AppendRequest[]): Promise<void> {
    const nonEmpty = requests.filter((r) => r.events.length > 0);

    // check everything first, then write: all or nothing
    const conflicted = nonEmpty
      .filter(
        (r) =>
          (this.streams.get(r.streamId)?.length ?? 0) !== r.expectedVersion,
      )
      .map((r) => r.streamId);
    if (conflicted.length) throw new ConcurrencyError(conflicted);

    const occurredAt = new Date().toISOString();

    for (const r of nonEmpty) {
      const stream = this.streams.get(r.streamId) ?? [];
      r.events.forEach((event, i) =>
        stream.push({
          streamId: r.streamId,
          version: r.expectedVersion + i + 1,
          eventId: randomUUID(),
          type: event.type,
          data: event,
          occurredAt,
          metadata: r.metadata ?? {},
        }),
      );
      this.streams.set(r.streamId, stream);
    }
  }
}

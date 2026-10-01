export abstract class EventStore {
  abstract readStream<E extends DomainEvent>(
    streamId: string,
  ): Promise<StoredEvent<E>[]>;
  abstract appendAtomically(requests: AppendRequest[]): Promise<void>;
}

export interface DomainEvent {
  type: string;
  // holdId: string;
}

export interface StoredEvent<E extends DomainEvent = DomainEvent> {
  streamId: string;
  version: number;
  eventId: string;
  type: E['type'];
  data: E;
  occurredAt: string;
  metadata: Record<string, string>;
}

export interface AppendRequest<E extends DomainEvent = DomainEvent> {
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

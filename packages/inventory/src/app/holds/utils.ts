export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function backoffMs(attempt: number) {
  return 50 * 2 ** (attempt - 1) + Math.random() * 50; // ~50, ~100, jittered
}

function streamId(kind: 'seat' | 'hold', eventId: string, id: string): string {
  const sep = '#';

  if (eventId.includes(sep) || id.includes(sep)) {
    throw new Error(`Ids must not contain "${sep}": ${eventId}, ${id}`);
  }

  return `${kind}${sep}${eventId}${sep}${id}`;
}

export function seatStreamId(eventId: string, seatId: string): string {
  return streamId('seat', eventId, seatId);
}

export function holdStreamId(eventId: string, holdId: string): string {
  return streamId('hold', eventId, holdId);
}

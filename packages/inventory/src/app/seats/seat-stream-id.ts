const SEP = '#';

export function seatStreamId(eventId: string, seatId: string): string {
  if (eventId.includes(SEP) || seatId.includes(SEP)) {
    throw new Error(`Ids must not contain "${SEP}": ${eventId}, ${seatId}`);
  }

  return `seat${SEP}${eventId}${SEP}${seatId}`;
}

export function parseSeatStreamId(streamId: string): {
  eventId: string;
  seatId: string;
} {
  const [prefix, eventId, seatId] = streamId.split(SEP);

  if (prefix !== 'seat' || !eventId || !seatId) {
    throw new Error(`Not a seat stream id: ${streamId}`);
  }

  return {
    eventId,
    seatId,
  };
}

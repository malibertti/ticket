export function isExpired(hold: { expiresAt: Date | string }, now: Date) {
  if (typeof hold.expiresAt === 'string') {
    return new Date(hold.expiresAt) <= now;
  }

  return hold.expiresAt <= now;
}

export function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}

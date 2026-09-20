import { BadRequestException } from '@nestjs/common';

export const encodeCursor = (v: unknown) =>
  Buffer.from(JSON.stringify(v)).toString('base64url');

export const decodeCursor = <T>(c: string): T => {
  try {
    return JSON.parse(Buffer.from(c, 'base64url').toString());
  } catch {
    throw new BadRequestException('Invalid cursor');
  }
};

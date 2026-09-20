import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { type ZodType } from 'zod';

@Injectable()
export class ZodPipe<T> implements PipeTransform {
  constructor(private schema: ZodType<T>) {}

  transform(value: unknown): T {
    const r = this.schema.safeParse(value);

    if (!r.success) {
      throw new BadRequestException(r.error.issues);
    }

    return r.data;
  }
}

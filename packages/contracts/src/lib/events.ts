import { z } from 'zod';

export const createEventInput = z.object({
  venueId: z.uuid(),
  title: z.string().min(1).max(200),
  startsAt: z.iso.datetime(),
  onSaleAt: z.iso.datetime(),
  status: z.string(),
});

export type CreateEventInput = z.infer<typeof createEventInput>;

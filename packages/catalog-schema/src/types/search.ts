import z from 'zod';
import { pageQuery } from './pagination.js';

export const searchEventsQuery = pageQuery.extend({
  q: z.string().trim().min(1).optional(),
  city: z.string().trim().max(100).optional(),
});

export type SearchEventsQuery = z.infer<typeof searchEventsQuery>;

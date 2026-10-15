import { z } from 'zod';

/** The status and status-event shapes shared by the saved requests and booked trips. */
export const RequestStatusSchema = z.enum([
  'pending',
  'approved',
  'ongoing',
  'completed',
  'cancelled',
  'rejected',
  'failed',
]);
export const StatusEventSchema = z.object({
  status: RequestStatusSchema,
  at: z.number(),
  by: z.string().optional(),
  note: z.string().optional(),
});

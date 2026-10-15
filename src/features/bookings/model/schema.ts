import { z } from 'zod';

/** The saved shape of the booked-trips document (`atiflow.bookings.v1`). The type below is what `BookedTrip` / the store use; this is the check applied when it is read back. */
export const RequestStatusSchema = z.enum(['pending', 'approved', 'ongoing', 'completed', 'cancelled', 'rejected', 'failed']);
export const StatusEventSchema = z.object({ status: RequestStatusSchema, at: z.number(), by: z.string().optional(), note: z.string().optional() });
export const BookedTripSchema = z.object({
  id: z.string(), tripId: z.string(), fleet: z.string(), fleetLive: z.string(), robotType: z.string(), robotLabel: z.string(),
  from: z.string(), to: z.string(), fromName: z.string(), toName: z.string(),
  status: RequestStatusSchema, history: z.array(StatusEventSchema),
  bookedBy: z.string(), bookedByName: z.string(), createdAt: z.number(), robotId: z.string().optional(), note: z.string().optional(),
});
export const BookingsDocumentSchema = z.object({ trips: z.array(BookedTripSchema), seq: z.number().int().nonnegative() });
export type BookingsDocument = z.infer<typeof BookingsDocumentSchema>;

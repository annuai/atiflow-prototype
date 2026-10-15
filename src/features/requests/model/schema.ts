import { z } from 'zod';
import { RequestStatusSchema, StatusEventSchema } from '@/data/statusSchema';

/** The saved shape of the requests document (`atiflow.requests.v1`): checked when it is read back. The types the store uses are in `types.ts`; a test keeps the two in step. */
/** `users` is optional on read: requests saved before approvals named users are brought up to date by `normalise`. */
export const ApprovalStepSchema = z.object({
  users: z.array(z.string()).optional(),
  by: z.string().optional(),
  at: z.number().optional(),
});
export const TripRequestSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  workflowId: z.string(),
  workflowName: z.string(),
  fleet: z.string(),
  fleetLive: z.string(),
  code: z.string(),
  name: z.string(),
  group: z.string(),
  qty: z.number(),
  legs: z.array(z.string()),
  loadFrom: z.number(),
  /** missing in requests saved before approvals existed: filled in by `normalise` */
  approvals: z.array(ApprovalStepSchema).optional(),
  needsApproval: z.boolean(),
  status: RequestStatusSchema,
  history: z.array(StatusEventSchema),
  requestedBy: z.string(),
  requestedByName: z.string(),
  createdAt: z.number(),
  /** missing in requests saved before trip ids existed */
  tripId: z.string().optional(),
  robotId: z.string().optional(),
  approvedBy: z.string().optional(),
  note: z.string().optional(),
  kind: z.literal('route').optional(),
  robotType: z.string().optional(),
});
export const RequestsDocumentSchema = z.object({
  requests: z.array(TripRequestSchema),
  seq: z.number().int().nonnegative(),
});
/** What is on disk; `normalise` turns it into `TripRequest[]`. */
export type RequestsDocument = z.infer<typeof RequestsDocumentSchema>;

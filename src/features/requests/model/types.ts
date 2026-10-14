/**
 * One request = one material for one trip. Several requests made together share a `groupId` (an order) only so the person can see they were made together;
 * from then on every request lives its own life: its own approval, its own trip, its own cancel.
 */
export type RequestStatus = 'pending' | 'approved' | 'ongoing' | 'completed' | 'cancelled' | 'rejected' | 'failed';
/** `by` is set once the step is approved. */
export interface ApprovalStep { stationId: string; by?: string; at?: number }
export interface StatusEvent { status: RequestStatus; at: number; /** name of the person (approver, requester) or 'Fleet' for the floor */ by?: string; note?: string }
export interface TripRequest {
  id: string; groupId: string;
  workflowId: string; workflowName: string; fleet: string; /** lane-map id of the fleet (what telemetry and orders use) */ fleetLive: string;
  /** What was asked for, as it was at that moment (names change, the request keeps what the person saw). */
  code: string; name: string; group: string; qty: number;
  /** The stations of the workflow's flow and the leg from which the load is carried. */
  legs: string[]; loadFrom: number;
  /** One approval per Confirm step of the workflow, in order: each is done by an operator mapped to that step's station. The trip starts only after all are done. */
  approvals: ApprovalStep[]; needsApproval: boolean;
  status: RequestStatus; history: StatusEvent[];
  requestedBy: string; requestedByName: string; createdAt: number;
  /** Given when the request is made (before approval), so it can be followed from the start; the robot is known once one takes it. */
  tripId: string; robotId?: string; approvedBy?: string; note?: string;
}
/** What can be requested: one material of one workflow. */
export interface RequestableItem {
  key: string; workflowId: string; workflowName: string; fleet: string; fleetLive: string;
  code: string; name: string; group: string;
  /** Quantity of the workflow's Material step; `qtyEditable` = the person may change it ("Select quantity from Tablet"). */
  qty: number; qtyEditable: boolean;
  /** Stations of the workflow's Confirm steps, in order (one approval each). */ approvalStations: string[]; needsApproval: boolean; legs: string[]; loadFrom: number;
}
/** A line of the cart (only exists while the person is choosing). */
export interface CartLine { key: string; qty: number }

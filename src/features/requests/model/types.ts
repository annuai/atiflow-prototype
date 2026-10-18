import type { CellPlan } from '@/features/master-data';
import type { FleetId } from '@/data/fleets';
/**
 * One request = one material for one trip. Several requests made together share a `groupId` (an order) only so the person can see they were made together;
 * from then on every request lives its own life: its own approval, its own trip, its own cancel.
 */
export type RequestStatus = 'pending' | 'approved' | 'ongoing' | 'completed' | 'cancelled' | 'rejected' | 'failed';
/** One approval: any one of `users` (usernames, never the requester) can give it. `by` (name) is set once it is approved. */
export interface ApprovalStep {
  users: string[];
  by?: string;
  at?: number;
}
export interface StatusEvent {
  status: RequestStatus;
  at: number;
  /** name of the person (approver, requester) or 'Fleet' for the floor */ by?: string;
  note?: string;
}
export interface TripRequest {
  id: string;
  groupId: string;
  workflowId: string;
  workflowName: string;
  /** id of the fleet (its current name is looked up when shown) */
  fleet: FleetId;
  /** lane-map id of the fleet (what telemetry and orders use) */ fleetLive: string;
  /** What was asked for, as it was at that moment (names change, the request keeps what the person saw). */
  code: string;
  name: string;
  group: string;
  qty: number;
  /** The stations (and staging areas, SA-xxx) of the workflow's flow and the leg from which the load is carried. */
  legs: string[];
  loadFrom: number;
  /** 'Pick Up' / 'Drop Off' of each leg (missing in older requests) */
  legActions?: string[];
  /** The staging-area cells this request holds (taken pieces, a reserved cell); settled when the trip ends. */
  cells?: CellPlan;
  /** One approval per Tablet Confirm step of the workflow, in order: each is done by one of that step's approval users. The trip starts only after all are done. */
  approvals: ApprovalStep[];
  needsApproval: boolean;
  status: RequestStatus;
  history: StatusEvent[];
  requestedBy: string;
  requestedByName: string;
  createdAt: number;
  /** Given when the request is made (before approval), so it can be followed from the start; the robot is known once one takes it. */
  tripId: string;
  robotId?: string;
  approvedBy?: string;
  note?: string;
  /** 'route' = a saved route (a workflow with no material: the robot just visits its stations, quantity 0, `name` is the workflow). Missing = a material request. */ kind?: 'route';
  /** Only a robot of this type (catalog id) takes it; any robot of the fleet when missing. */ robotType?: string;
}
/** What can be requested: one material of one workflow. */
export interface RequestableItem {
  key: string;
  workflowId: string;
  workflowName: string;
  fleet: FleetId;
  fleetLive: string;
  code: string;
  name: string;
  group: string;
  /** Quantity of the workflow's Material step; `qtyEditable` = the person may change it ("Select quantity from Tablet"). */
  qty: number;
  qtyEditable: boolean;
  /** The approval users of each Tablet Confirm step, in order (one approval each). */ approvalUsers: string[][];
  needsApproval: boolean;
  legs: string[];
  loadFrom: number;
  /** 'Pick Up' / 'Drop Off' of each leg */
  legActions: string[];
  /** 'route' = a saved route (no material, quantity 1 in the cart, 0 on the request). */ kind?: 'route';
  robotType?: string;
}
/** A line of the cart (only exists while the person is choosing). */
export interface CartLine {
  key: string;
  qty: number;
}

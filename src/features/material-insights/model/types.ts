import type { RequestStatus } from '@/features/requests';

/** The part of a material request the insights read (a `TripRequest` has more; the sample data only makes these). */
export interface MaterialRequest {
  id: string;
  fleet: string;
  code: string;
  name: string;
  qty: number;
  status: RequestStatus;
  needsApproval: boolean;
  createdAt: number;
  /** the stations of the flow: [pick up, ..., drop off] */
  legs: string[];
  robotId?: string;
  /** when each status was reached (ms), from the request's history */
  at: Partial<Record<RequestStatus, number>>;
}

/** A period of whole days, with the words used for it. */
export interface Period {
  from: Date;
  to: Date;
  days: number;
  label: string;
  previousLabel: string;
}

/** Everything the KPI cards show for one period. Durations are in minutes (null = nothing to average). */
export interface MaterialStats {
  /** requests received in the period */
  requests: number;
  /** pieces asked for by those requests */
  unitsAsked: number;
  /** requests delivered in the period */
  delivered: number;
  /** pieces delivered in the period */
  units: number;
  cancelled: number;
  rejected: number;
  failed: number;
  /** delivered / everything that ended in the period, in % (null when nothing ended) */
  fulfilmentPct: number | null;
  /** request -> approved, only requests that needed approval */
  approvalMin: number | null;
  /** approved -> a robot took it */
  robotWaitMin: number | null;
  /** a robot took it -> delivered */
  deliveryMin: number | null;
  /** request -> delivered */
  cycleMin: number | null;
}

export interface TopMaterial {
  code: string;
  name: string;
  units: number;
  requests: number;
}
export interface Waiting {
  approval: MaterialRequest[];
  robot: MaterialRequest[];
  moving: MaterialRequest[];
  /** age (ms) of the oldest request waiting for approval / for a robot, 0 when none */
  oldestApprovalMs: number;
  oldestRobotMs: number;
}
export interface MaterialsView {
  origin: 'live' | 'sample';
  stats: MaterialStats;
  previous: MaterialStats;
  /** pieces delivered per bucket (hour for one day, day otherwise) */
  series: { label: Date; units: number }[];
  bucket: 'hour' | 'day';
  top: TopMaterial[];
  byFleet: { fleet: string; units: number }[];
  waiting: Waiting;
}

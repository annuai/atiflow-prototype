import { type RequestStatus, type StatusEvent } from '@/features/requests';

/**
 * A custom trip an operator booked: a robot of the chosen type drives from a start station to an end station. No material, no approval, no stops: it goes straight to the fleet
 * (status Approved = waiting for a robot) and then follows the floor's reports like a requested trip. The names are kept as they were when it was booked.
 */
export interface BookedTrip {
  id: string;
  /** TRP-xxx, from the shared trip counter */ tripId: string;
  fleet: string;
  /** lane-map id of the fleet */ fleetLive: string;
  /** robot type id (telemetry `model`) and its name as it was shown */ robotType: string;
  robotLabel: string;
  from: string;
  to: string;
  fromName: string;
  toName: string;
  status: RequestStatus;
  history: StatusEvent[];
  bookedBy: string;
  bookedByName: string;
  createdAt: number;
  robotId?: string;
  note?: string;
}
export interface BookingInput {
  fleet: string;
  fleetLive: string;
  robotType: string;
  robotLabel: string;
  from: string;
  to: string;
  fromName: string;
  toName: string;
}

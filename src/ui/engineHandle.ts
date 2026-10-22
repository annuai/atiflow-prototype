import type { Engine } from '../engine/Engine';
import type { ChargeResult, RelocalizeResult, StopResult } from '../core/types';
/** What the 3D page and the live feed hand to the shared UI: the engine (camera) and the "send to charger" command. */
export const handle: {
  engine: Engine | null;
  sendToCharger?: (robotId: string) => ChargeResult;
  relocalize?: (robotId: string) => RelocalizeResult;
  emergencyStop?: (robotId: string) => StopResult;
  releaseStop?: (robotId: string) => StopResult;
  stopFleet?: (fleetId: string, stop: boolean) => StopResult;
} = { engine: null };

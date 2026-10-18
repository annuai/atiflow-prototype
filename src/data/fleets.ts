import seed from '@/fixtures/dataset.json';

/**
 * A fleet's id: the stable key every other store uses to point at a fleet (a workflow, a material, a robot, a request). A fleet's NAME can be changed at any time without touching
 * anything but the fleet list, because nothing else stores it. A branded string, so the compiler tells a name from an id (`asFleetId` is for the few places that make one).
 */
export type FleetId = string & { readonly __fleetId: unique symbol };
export const asFleetId = (id: string) => id as FleetId;

/** A fleet of the site. The list itself is part of the shared dataset (`dataset.ts`); read it through `fleetDirectory`. */
export interface FleetRecord {
  /** Stable id. */
  id: FleetId;
  /** The name shown everywhere. */
  name: string;
  /** Colour used for the fleet on maps and charts. */
  color: string;
  /** Id this fleet has in the Live Floor's lane map (nav.json), when it has a map to run on. */
  liveId?: string;
}

/** Names of the two starting fleets (for the default names of seed workflows). */
export const FLEET_NAME = { lineSide: seed.fleets[0].name, assembly: seed.fleets[1].name } as const;
/** Ids of the two starting fleets, for seed data that has to point at a fleet. */
export const FLEET_ID = { lineSide: asFleetId(seed.fleets[0].id), assembly: asFleetId(seed.fleets[1].id) } as const;

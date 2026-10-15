import seed from '@/fixtures/dataset.json';

/** A fleet of the site. The list itself is part of the shared dataset (`dataset.ts`); read it through `fleetDirectory`. */
export interface FleetRecord {
  /** Stable id. */
  id: string;
  /** The name shown everywhere. */
  name: string;
  /** Colour used for the fleet on maps and charts. */
  color: string;
  /** Id this fleet has in the Live Floor's lane map (nav.json), when it has a map to run on. */
  liveId?: string;
}

/** Names of the two starting fleets, for seed data that has to refer to a fleet by name. */
export const FLEET_NAME = { lineSide: seed.fleets[0].name, assembly: seed.fleets[1].name } as const;

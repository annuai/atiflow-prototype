export interface MapStation {
  id: string;
  name: string;
}
/** A site map known to the system. Stations belong to the map, so a fleet can only group materials at its own map's stations. */
export interface FleetMap {
  id: string;
  name: string;
  version: number;
  tag: string;
  /** The lane-map fleet that runs on this map: its lanes, areas and stations are what the thumbnail draws. */ fleetLive: string;
  /** When the map was last changed (epoch ms). */ updatedAt: number;
  stations: MapStation[];
  /** 'imported' = made from a Deployment Manager map file (no lane map of its own yet; its picture is a stored floor image). */ source?: 'imported';
}

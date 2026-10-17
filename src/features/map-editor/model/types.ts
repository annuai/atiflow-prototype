import type { Lane, NavNode, Station } from '@/core/types';

/** The kinds of zone a map can hold. Add a type in `zoneTypes.ts`; nothing else needs to know. */
export type ZoneTypeId = string;
export type ZoneProp = string | number | boolean;
/**
 * What a zone is: a rotated rectangle (`rot` in radians, 0 = +x, counter-clockwise; metres, site frame), or a Line gate = a line a -> b whose area reaches `depth` metres to `side`
 * (+1 = left of a -> b): the side robots come from. A robot arriving from that side waits until the whole area is clear; one arriving from the other side crosses freely.
 */
export type ZoneShape =
  | { kind: 'rect'; cx: number; cy: number; w: number; h: number; rot: number }
  | { kind: 'gate'; a: [number, number]; b: [number, number]; depth: number; side: 1 | -1 };
/** One zone of some type, with that type's settings in `props`. `shape` is what is edited; `polygon` is always derived from it (`polygonOf`) for everything that reads outlines. */
export interface MapZone {
  id: string;
  type: ZoneTypeId;
  name: string;
  shape: ZoneShape;
  polygon: [number, number][];
  props: Record<string, ZoneProp>;
}

/** A station of a map: the fleet's station plus how a robot stands at it. */
export interface MapStation extends Station {
  /** heading of the robot at the station (degrees) */ angle?: number;
  /** stands on the lane (true, default) or off it */ onLane?: boolean;
}

/** A road: one drawn line with its paired one-way lanes (keep right), or a single lane when one-way. `points` is the centre line. */
/** Which way the robot faces on a road (a setting for later; nothing reads it yet). */
export type RoadHeading = 'both' | 'forward' | 'backward';
/** `points` is the CENTRE line of the road; its lanes are drawn 0.5 m to the right of it (one per direction). */
export interface MapRoad {
  id: string;
  name: string;
  oneWay: boolean;
  points: [number, number][];
  laneIds: string[];
  heading?: RoadHeading;
}

/**
 * A staging area: a big area of rows x columns cells (a table on the floor). `x, y` is the centre of the A1 cell; columns run along the area's direction, rows go "down" from it
 * (rotated by `rotation` degrees). The geometry belongs to the map; the state of the cells belongs to Master Data (see master-data/model/stagingFromMaps.ts).
 */
export interface StagingAreaDef {
  id: string;
  name: string;
  sherpaType: string;
  rotation: number;
  x: number;
  y: number;
  rows: number;
  cols: number;
  cellLength: number;
  cellWidth: number;
}

/** Everything a map holds: its own network (nodes, one-way lanes grouped in roads), its stations, staging areas and zones. The editor changes this; the floor will read the published one. */
export interface MapData {
  nodes: NavNode[];
  lanes: Lane[];
  roads: MapRoad[];
  stations: MapStation[];
  stagingAreas: StagingAreaDef[];
  zones: MapZone[];
}

export type VersionStatus = 'published' | 'draft';
/** A published version is read-only for good; the draft is the only thing that can be edited. */
export interface MapVersion {
  id: string;
  mapId: string;
  status: VersionStatus;
  /** v5, v6... for published versions; null for the draft. */ number: number | null;
  /** The published version this draft was made from (or restored from). */ basedOn: number | null;
  createdAt: number;
  createdBy: string;
  publishedAt?: number;
  publishedBy?: string;
  data: MapData;
}
export interface MapHistory {
  versions: MapVersion[];
}

/** What the editor has selected. */
export type Selection = { kind: 'station' | 'road' | 'zone' | 'staging'; id: string } | null;

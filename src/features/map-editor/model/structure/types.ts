/**
 * The 3D structure of a map as a person edits it: elements (walls, partitions, machines, pillars, floor areas, doors) One floor; every
 * element has its own height. The lidar estimate (`MapData.structure`) stays as it was found: elements are what a person drew or traced from it, and `hidden*` lists what of the
 * estimate has been removed or replaced, so nothing is ever lost and the estimate can be brought back.
 */
export type P = [number, number];
export type ElementKind = 'wall' | 'partition' | 'machine' | 'pillar' | 'area' | 'door';

interface Common {
  id: string;
  /** own colour (`#rrggbb`); without one the kind's own colour is used */
  color?: string;
  /** text shown on top of it (machines, areas) */
  label?: string;
  /** height of the top above the floor, or above `base` (m) */
  height: number;
  /** where it starts above the floor (m): overhead pipes and conveyors; 0 = on the floor */
  base?: number;
  /** 0..1, glass */
  opacity?: number;
  /** a name in the list */
  name?: string;
  /** made from a wall or machine of the lidar estimate (so a route through it is a warning: the estimate is rough) */
  traced?: boolean;
}
/** A wall or a partition (a lower wall): a line through points, with a thickness. */
export interface LineElement extends Common {
  kind: 'wall' | 'partition';
  points: P[];
  thickness: number;
}
/** A machine or a pillar: a block, `rot` in radians counter-clockwise. */
export interface BoxElement extends Common {
  kind: 'machine' | 'pillar';
  x: number;
  y: number;
  w: number;
  d: number;
  rot: number;
}
/** A floor area (height 0: a coloured patch of floor) or an extrusion of any outline (height above 0). */
export interface AreaElement extends Common {
  kind: 'area';
  points: P[];
  /** A Work area: a named, coloured part of the floor (Assembly Workstations, SMT Lines...). The Live Floor draws it as a tinted patch with its name, not as a solid. */
  work?: boolean;
  /** The id this area had when it was a zone of the lane map (what a fleet's area list refers to) */
  fromZone?: string;
  /** The outline is the drawing's own (not the rectangle an earlier version fitted round it) */
  exact?: boolean;
}
/** An opening in a wall or partition: where it is, how wide, the way the wall runs (`rot`), how high it is (`height`: the wall above it stays). */
export interface DoorElement extends Common {
  kind: 'door';
  x: number;
  y: number;
  w: number;
  rot: number;
}
export type StructureElement = LineElement | BoxElement | AreaElement | DoorElement;

export interface MapModel3d {
  elements: StructureElement[];
  /** indexes into `MapData.structure.walls` / `.equipment` that are removed or replaced by an element: they are not shown and can be brought back */
  hiddenWalls: number[];
  hiddenEquipment: number[];
}
export const emptyModel = (): MapModel3d => ({ elements: [], hiddenWalls: [], hiddenEquipment: [] });

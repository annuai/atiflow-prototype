export type NodeTypeId = 'start' | 'material' | 'logic' | 'container' | 'wait' | 'station' | 'confirm' | 'end';
export type FieldValue = string | boolean | string[];

export interface WfNode {
  id: string;
  t: NodeTypeId;
  f: Record<string, FieldValue>;
  /** If Logic only: the two branches (TRUE / OTHERWISE). */
  br?: { t: WfNode[]; o: WfNode[] };
}
/** Where a node list lives: the main flow, or one branch of an If Logic node ("<nodeId>:t" / "<nodeId>:o"). */
export type ListKey = 'main' | string;

export type FieldKind = 'select' | 'multi' | 'check' | 'input' | 'cond' | 'users';
export interface FieldSpec {
  key: string;
  label: string | ((n: WfNode) => string);
  kind?: FieldKind;
  opts?: string[];
  /** Options come from outside the registry. `fleetMaterials` = materials assigned to the open fleet in Master Data; `fleetStations` = the work stations of the fleet's map. */
  optsFrom?: 'fleetMaterials' | 'fleetStations' | 'requestUsers' | 'approvalUsers';
  /** The field is only there when this is true (e.g. the Start step lists users only for a Tablet request). */
  showIf?: (n: WfNode) => boolean;
  /** Render label and control on one row. */
  row?: boolean;
  /** Overrides applied when the node sits inside a branch (e.g. Station uses S-numbers there). */
  branch?: Partial<FieldSpec>;
}
export type IconId = 'play' | 'keyframes' | 'box' | 'clock' | 'pin' | 'badge' | 'square' | 'antenna';
export interface NodeTypeSpec {
  label: string;
  accent: string;
  icon: IconId;
  /** Card width on the canvas (px) and width when inside a branch. */
  w: number;
  bw?: number;
  fields: FieldSpec[];
  note?: string;
  /** Start / End: always present, cannot be removed or moved. */
  fixed?: boolean;
  defaults?: Record<string, FieldValue>;
}
/**
 * One workflow. `fleet` is null until the user picks a fleet for a new workflow. `published`: set by Publish, cleared by any later edit.
 * `saved`: set by Save Draft (or Publish). A workflow that is neither saved nor published is discarded when the user leaves it.
 */
export interface Workflow {
  id: string;
  name: string;
  fleet: string | null;
  nodes: WfNode[];
  published?: boolean;
  saved?: boolean;
}
export type Workflows = Record<string, Workflow>;

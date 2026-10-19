/** The patch of floor the plan last showed (site metres), so the 3D view can open on the same place. */
export interface PlanView {
  /** the map's bounds, to tell one map from another */
  key: string;
  x: number;
  y: number;
  width: number;
}
let last: PlanView | null = null;
export const rememberPlanView = (v: PlanView) => {
  last = v;
};
export const planViewOf = (key: string): PlanView | null => (last && last.key === key ? last : null);
export const boundsKey = (b: { minX: number; maxX: number; minY: number; maxY: number }) =>
  `${b.minX},${b.maxX},${b.minY},${b.maxY}`;

/** The patch of floor the 3D view was showing when it was left: the plan opens on it (once). */
let from3d: PlanView | null = null;
export const rememberView3d = (v: PlanView) => {
  from3d = v;
};
export const takeView3d = (key: string): PlanView | null => {
  const v = from3d && from3d.key === key ? from3d : null;
  from3d = null;
  return v;
};

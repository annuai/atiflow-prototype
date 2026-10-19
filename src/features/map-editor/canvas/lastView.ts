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

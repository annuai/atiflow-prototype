/** Public entry of material insights: the Dashboard "Materials" view, the Reports "Materials" section and the test for whether a person has material to report on. */
export { MaterialsLive } from './components/MaterialsLive';
export { MaterialsReport } from './components/MaterialsReport';
export { hasMaterialWorkflows, useMaterialsRelevant } from './model/useMaterials';
export type { Period } from './model/types';
export { ViewSwitch, type InsightView } from './components/ViewSwitch';

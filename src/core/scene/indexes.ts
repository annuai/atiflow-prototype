import { LaneGraph } from '../lanes';
import { RulesIndex } from '../rules';
import type { SceneModel } from './model';

export interface SceneIndexes {
  lanes: LaneGraph;
  rules: RulesIndex;
}
const cache = new WeakMap<SceneModel, SceneIndexes>();

/**
 * The lookups a scene needs (route finding over its lanes, the rules checker over its network and building). Built the first time they are asked for and kept as long as the model lives, so
 * a scene that is shown again costs nothing; when its model is dropped they go with it.
 */
export function sceneIndexes(m: SceneModel): SceneIndexes {
  let i = cache.get(m);
  if (!i) {
    i = { lanes: new LaneGraph(m.network), rules: new RulesIndex(m.network, m.geometry.site) };
    cache.set(m, i);
  }
  return i;
}

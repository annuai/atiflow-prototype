import { datasetStore } from '@/data/dataset';
import { fleetScope } from '@/features/access';
import { masterDataStore } from '@/features/master-data';
import { fleetLiveOf, requestableItems, routeItems, type RequestableItem } from '@/features/requests';
import { wfStore } from '@/features/workflow-builder';
import type { SearchContext } from '../types';

/** What an operator may request, with the SAME rules as the Book trip page (published, tablet, their fleet, listed in the Start step). Materials and saved trips. */
export function operatorItems(ctx: SearchContext): { materials: RequestableItem[]; trips: RequestableItem[] } {
  const ids = datasetStore.getState().fleets.map((f) => f.id);
  const who = { username: ctx.user.username, fleets: fleetScope(ctx.user, ids) ?? ids };
  const workflows = Object.values(wfStore.getState().workflows);
  const md = masterDataStore.getState();
  return {
    materials: requestableItems(workflows, who, fleetLiveOf, md.materials, md.groups),
    trips: routeItems(workflows, who, fleetLiveOf),
  };
}

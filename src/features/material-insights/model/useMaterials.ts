import { useMemo } from 'react';
import { useNow } from '@/hooks/use-now';
import { useVisibleFleets } from '@/features/auth';
import { useFleetFilter } from '@/features/fleet-filter';
import { flatten, useRequests, type TripRequest } from '@/features/requests';
import { isKept, useWorkflow, type Workflow } from '@/features/workflow-builder';
import { byFleet, series, stats, topMaterials, waiting } from './kpis';
import { sampleRequests } from './sample';
import type { MaterialRequest, MaterialsView, Period } from './types';

/** A stored request as the insights read it: when each status was first reached comes from its history. */
function toMaterialRequest(r: TripRequest): MaterialRequest {
  const at: MaterialRequest['at'] = {};
  for (const e of r.history) if (at[e.status] === undefined) at[e.status] = e.at;
  return {
    id: r.id,
    fleet: r.fleet,
    code: r.code,
    name: r.name,
    qty: r.qty,
    status: r.status,
    needsApproval: r.needsApproval,
    createdAt: r.createdAt,
    legs: r.legs,
    robotId: r.robotId,
    at,
  };
}

/**
 * The material requests of the person's fleets, or of the fleet chosen in the page's fleet filter (saved routes carry no material, so they are not material requests).
 * `everyFleet` ignores the filter (used to decide whether material views make sense at all).
 */
function useMaterialRequests(everyFleet = false): MaterialRequest[] {
  const fleets = useVisibleFleets();
  const { fleetId } = useFleetFilter();
  const all = useRequests((s) => s.requests);
  return useMemo(() => {
    const ids = new Set<string>(fleets.map((f) => f.id));
    const chosen = fleets.find((f) => (f.liveId ?? f.id) === fleetId)?.id; // (the filter's option ids are the map's ids)
    return all
      .filter((r) => r.kind !== 'route' && ids.has(r.fleet) && (everyFleet || !chosen || r.fleet === chosen))
      .map(toMaterialRequest);
  }, [all, fleets, fleetId, everyFleet]);
}

/**
 * Do material insights make sense for this person? Only when one of their fleets runs a workflow with a Material step (or has material requests already). A fleet that only runs
 * saved routes (robots driving between stations, no material) gets no material views at all.
 */
export function hasMaterialWorkflows(workflows: Record<string, Workflow>, fleetIds: string[]): boolean {
  const ids = new Set(fleetIds);
  return Object.values(workflows).some(
    (w) => isKept(w) && w.fleet !== null && ids.has(w.fleet) && flatten(w.nodes).some((n) => n.t === 'material'),
  );
}

export function useMaterialsRelevant(): boolean {
  const fleets = useVisibleFleets();
  const workflows = useWorkflow((s) => s.workflows);
  const requests = useMaterialRequests(true); // every fleet: the switch must not vanish because the chosen fleet has none
  return useMemo(
    () =>
      requests.length > 0 ||
      hasMaterialWorkflows(
        workflows,
        fleets.map((f) => f.id),
      ),
    [fleets, workflows, requests],
  );
}

const DAY = 86_400_000;
const endOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();

/**
 * Everything the materials views show for a period: this period, the one before it, the series, the top materials and what is waiting right now. With no real requests in the
 * period and the one before it, EXAMPLE requests are used and `origin` says so (the views then show a "Sample data" badge).
 */
export function useMaterialsView(period: Period, tickMs = 30_000): MaterialsView {
  const real = useMaterialRequests();
  const fleets = useVisibleFleets();
  const { fleetId } = useFleetFilter();
  const now = useNow(tickMs);
  return useMemo(() => {
    const from = period.from.getTime(),
      to = Math.min(endOf(period.to), Math.max(now, from)),
      len = endOf(period.to) - from,
      prevFrom = from - len;
    // a period that is still running (today) is compared with the same stretch of the one before it (yesterday up to this time), not with all of it
    const hasReal = real.some((r) => r.createdAt >= prevFrom - DAY && r.createdAt < endOf(period.to));
    const chosen = fleets.find((f) => (f.liveId ?? f.id) === fleetId);
    const fleetIds = chosen ? [chosen.id] : fleets.map((f) => f.id);
    const data = hasReal ? real : sampleRequests(new Date(prevFrom), period.to, fleetIds, now);
    const s = series(data, period.from, period.to);
    return {
      origin: hasReal ? 'live' : 'sample',
      stats: stats(data, from, to),
      previous: stats(data, prevFrom, prevFrom + (to - from)),
      series: s.points,
      bucket: s.bucket,
      top: topMaterials(data, from, to),
      byFleet: byFleet(data, from, to),
      waiting: waiting(data, to),
    };
  }, [real, fleets, fleetId, period, now]);
}

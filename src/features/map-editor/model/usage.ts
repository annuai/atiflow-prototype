import { flatten } from '@/features/requests/model/catalog';
import type { Workflow } from '@/features/workflow-builder/model/types';

/** The names of the published workflows of a fleet that use a station (a Station step or an If Logic station). */
export function workflowsUsing(workflows: Workflow[], fleetName: string | null | undefined, stationId: string): string[] {
  const hit = (v: unknown) => (Array.isArray(v) ? v.includes(stationId) : v === stationId);
  return workflows.filter((w) => w.published && w.fleet === fleetName && flatten(w.nodes).some((n) => (n.t === 'station' || n.t === 'logic') && hit(n.f.station))).map((w) => w.name);
}

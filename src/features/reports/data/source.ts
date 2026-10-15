import { datasetStore } from '@/data/dataset';
import { robotRecords, robotsOnFloor } from '@/data/robots';
import { feed, measurements } from '@/features/live-floor';
import { buildReport } from '../model/kpis';
import { previousRange, startOfDay } from '../model/range';
import type { ReportSource } from '../model/types';
import { sampleMeasured, type RosterRobot } from './sampleMeasured';

/** Less data than this and "Today" falls back to the sample figures (a few seconds of simulator run say nothing yet). */
const MIN_LIVE_S = 180;

export interface SourceDeps {
  roster(): Promise<RosterRobot[]>;
  live?: { query(from: number, to: number): import('@/core/measurements').Measured };
  now?(): Date;
  delayMs?: number;
}

/**
 * The Reports source. "Today" is MEASURED from the running fleet (the measurement log fed by the simulator's telemetry and events) once it has a few minutes
 * of data; every other period is SAMPLE data from `sampleMeasured` until a history API exists. Both go through the same KPI formulas (`buildReport`).
 */
export function createReportSource(deps: SourceDeps): ReportSource {
  const now = deps.now ?? (() => new Date());
  return {
    async fetch(range) {
      const roster = await deps.roster();
      if (range.preset === 'today' && deps.live) {
        const t = now(),
          m = deps.live.query(startOfDay(t).getTime(), t.getTime());
        if (m.observedS >= MIN_LIVE_S)
          return buildReport(range, m, null, { kind: 'live', observedMin: Math.round(m.observedS / 60) });
      }
      if (deps.delayMs) await new Promise((r) => setTimeout(r, deps.delayMs)); // feels like a request
      const m = sampleMeasured(roster, range, now()),
        prev = sampleMeasured(roster, previousRange(range), now());
      return buildReport(range, m, prev, { kind: 'sample' });
    },
  };
}

/** The source in use. The robots are the ones on the Live Floor (same definition: `robotsOnFloor`), so the report and the floor list the same robots. */
export const reportSource = createReportSource({
  roster: async () => {
    const { nav } = await feed.ready();
    return robotsOnFloor(
      robotRecords(datasetStore.getState()),
      nav.fleets.map((f) => f.id),
    ).map((r) => ({ id: r.id, fleetId: r.fleet!.liveId ?? r.fleet!.id }));
  },
  live: measurements,
  delayMs: 350,
});

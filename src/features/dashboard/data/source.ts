import { useEffect, useMemo, useRef, useState } from 'react';
import { store } from '@/core/store';
import { visibleFleets } from '@/features/auth';
import { feed, sceneOfFleet } from '@/features/live-floor';
import { myPrefsNow } from '@/features/preferences';
import { DashboardEngine } from './engine';
import type { DashboardInput, DashboardSnapshot, DashboardSource } from './types';

/**
 * Today's source: the simulator feed that also drives the Live Floor, with fleet names from the shared dataset. `fleet` (the id its robots carry) limits everything to that fleet: its
 * robots, its stations, its building; without it the data is every fleet the person can see, combined. Replace with a source that reads the real fleet API.
 */
export const createLiveSource = (fleet?: string): DashboardSource => ({
  subscribe(onInput) {
    const release = feed.acquire();
    void feed.ready();
    const emit = () => {
      const s = store.getState();
      const fleets = visibleFleets()
        .map((f) => ({ id: f.liveId ?? f.id, name: f.name, color: f.color })) // robots carry the lane-map id of their fleet
        .filter((f) => !fleet || f.id === fleet);
      const a = myPrefsNow().alerts;
      const w = feed.world();
      const scene = fleet && w ? sceneOfFleet(w, fleet) : null;
      onInput({
        thresholds: { waitWarnS: a.waitWarnS, waitUrgentS: a.waitUrgentS, batteryLow: a.batteryLow },
        now: Date.now(),
        robots: Object.values(s.robots).filter((r) => !fleet || r.fleetId === fleet),
        stations: (s.nav?.stations ?? []).filter((st) => !fleet || st.fleets.includes(fleet)),
        fleets,
        site: scene?.site ?? s.site, // one fleet is drawn on its own map
      });
    };
    const off = feed.onBatch(emit);
    emit();
    return () => {
      off();
      release();
    };
  },
});
export const liveSource: DashboardSource = createLiveSource();

/** The dashboard's numbers as a React hook: runs the engine on every input and hands out a fresh snapshot about twice a second. */
export function useDashboard(source: DashboardSource = liveSource, refreshMs = 500): DashboardSnapshot | null {
  const engine = useMemo(() => new DashboardEngine(), [source]); // eslint-disable-line react-hooks/exhaustive-deps -- another source (another fleet) starts its own history
  const [snap, setSnap] = useState<DashboardSnapshot | null>(null);
  const last = useRef(0);
  useEffect(() => {
    last.current = 0; // the first input of a new source is shown at once
    return source.subscribe((i: DashboardInput) => {
      engine.ingest(i);
      const t = performance.now();
      if (t - last.current >= refreshMs) {
        last.current = t;
        setSnap(engine.snapshot());
      }
    });
  }, [source, engine, refreshMs]);
  return snap;
}

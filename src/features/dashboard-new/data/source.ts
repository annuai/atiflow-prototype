import { useEffect, useMemo, useRef, useState } from 'react';
import { store } from '@/core/store';
import { datasetStore } from '@/data/dataset';
import { feed } from '@/features/live-floor/liveFeed';
import { DashboardEngine } from './engine';
import type { DashboardInput, DashboardSnapshot, DashboardSource } from './types';

/** Today's source: the simulator feed that also drives the Live Floor, with fleet names from the shared dataset. Replace with a source that reads the real fleet API. */
export const liveSource: DashboardSource = {
  subscribe(onInput) {
    const release = feed.acquire(); void feed.ready();
    const emit = () => {
      const s = store.getState();
      const fleets = datasetStore.getState().fleets.map((f) => ({ id: f.liveId ?? f.id, name: f.name, color: f.color }));       // robots carry the lane-map id of their fleet
      onInput({ now: Date.now(), robots: Object.values(s.robots), stations: s.nav?.stations ?? [], fleets, site: s.site });
    };
    const off = feed.onBatch(emit); emit();
    return () => { off(); release(); };
  },
};

/** The dashboard's numbers as a React hook: runs the engine on every input and hands out a fresh snapshot about twice a second. */
export function useDashboard(source: DashboardSource = liveSource, refreshMs = 500): DashboardSnapshot | null {
  const engine = useMemo(() => new DashboardEngine(), []); const [snap, setSnap] = useState<DashboardSnapshot | null>(null); const last = useRef(0);
  useEffect(() => source.subscribe((i: DashboardInput) => { engine.ingest(i); const t = performance.now(); if (t - last.current >= refreshMs) { last.current = t; setSnap(engine.snapshot()); } }), [source, engine, refreshMs]);
  return snap;
}

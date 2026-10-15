import { createStore } from 'zustand/vanilla';
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { store } from '@/core/store';
import { createDocument, localBackend } from '@/data/storage';
import { visibleLiveIds } from '@/features/access/useFleetScope';
import { feed } from '@/features/live-floor/liveFeed';
import { myPrefsNow } from '@/features/preferences/data/store';
import { ActionCenterEngine, type ActionState } from '../model/engine';
import type { Call } from '../model/types';

/**
 * The Action Center's calls. Open calls come from the live telemetry (and so from the same fleet scope as everything else); the resolved log is kept in
 * this browser so it survives a reload and can be exported. A server later = another place to save the log and the claims (`ActionCenterEngine` stays).
 */
const logDoc = createDocument<Call[]>(
  localBackend('atiflow.actioncenter.v1'),
  () => [],
  (v): v is Call[] => Array.isArray(v),
);
export const actionCenter = createStore<ActionState>(() => ({ active: [], log: [] }));
export const engine = new ActionCenterEngine(logDoc.load(), (s) => {
  actionCenter.setState(s);
});
actionCenter.setState(engine.state);
let saved = engine.state.log;
actionCenter.subscribe((s) => {
  if (s.log !== saved) {
    saved = s.log;
    logDoc.save(s.log);
  }
});
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key === 'atiflow.actioncenter.v1' && e.newValue) {
      try {
        const v = JSON.parse(e.newValue);
        if (Array.isArray(v)) {
          engine.state = { ...engine.state, log: v };
          saved = v;
          actionCenter.setState({ log: v });
        }
      } catch {
        /* ignore */
      }
    }
  });

/** The calls this person may see: only their fleets (the feed already filters, this also guards the saved log, which belongs to the whole browser). */
export const inScope = (c: Call): boolean => {
  const ids = visibleLiveIds();
  return !ids || ids.has(c.fleetId);
};
export const useActionState = (): ActionState => useStore(actionCenter, (s) => s);

let users = 0,
  off: (() => void)[] = [];
function startRunning() {
  const release = feed.acquire();
  void feed.ready();
  const offBatch = feed.onBatch(() => {
    const a = myPrefsNow().alerts;
    engine.ingest(Object.values(store.getState().robots), Date.now(), {
      waitCallS: a.notifyAfterS,
      waitUrgentS: a.waitUrgentS,
      batteryLow: a.batteryLow,
    });
  });
  const offReset = feed.onReset(() => engine.clearActive());
  off = [offBatch, offReset, release];
}
/** Keeps the calls up to date while any part of the Action Center (the page, the sidebar badge) is on screen. One shared run, however many users of it. */
export function useActionCenterRunning() {
  useEffect(() => {
    if (users++ === 0) startRunning();
    return () => {
      if (--users === 0) {
        off.forEach((f) => f());
        off = [];
      }
    };
  }, []);
}

/** True once the first look at the floor has arrived (or after 4 s, so a person with no robots is not kept waiting): until then an empty queue means "not known yet", not "all clear". */
export function useFeedReady(): boolean {
  const [ready, setReady] = useState(() => Object.keys(store.getState().robots).length > 0);
  useEffect(() => {
    if (ready) return;
    const done = () => setReady(true);
    const off = feed.onBatch(done);
    const t = window.setTimeout(done, 4000);
    return () => {
      off();
      window.clearTimeout(t);
    };
  }, [ready]);
  return ready;
}

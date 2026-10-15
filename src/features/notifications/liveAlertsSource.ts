import { store } from '@/core/store';
import { fleetDirectory } from '@/data/fleetDirectory';
import { feed } from '@/features/live-floor/liveFeed';
import { myPrefsNow } from '@/features/preferences/data/store';
import { RobotAlertWatcher } from './robotAlerts';
import type { NotificationSource } from './types';

/** Supervisors: blocked / faulty / stuck / low-battery robots from the live feed (the same feed the Live Floor and Dashboard use). */
export const liveAlertsSource = (): NotificationSource => ({
  start(emit) {
    const watcher = new RobotAlertWatcher(
      (id) => fleetDirectory.byLiveId(id)?.name ?? id,
      () => myPrefsNow().alerts,
    );
    const release = feed.acquire();
    void feed.ready();
    const off = feed.onBatch(() => {
      const out = watcher.ingest(Date.now(), Object.values(store.getState().robots));
      if (out.length) emit(out);
    });
    return () => {
      off();
      release();
    };
  },
});

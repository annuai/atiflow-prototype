import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { copy } from '../copy';
import { masterDataStore } from '../model/store';
import type { IncomingMaterial } from '../model/types';
import { notify } from '@/ui/toast';

export interface JobState {
  status: 'idle' | 'running' | 'done' | 'cancelled';
  fileName: string;
  total: number;
  done: number;
}
const IDLE: JobState = { status: 'idle', fileName: '', total: 0, done: 0 };
export const jobStore = createStore<JobState>(() => IDLE);
export const useImportJob = <T>(sel: (s: JobState) => T) => useStore(jobStore, sel);

const TICKS = 12,
  TICK_MS = 160;
let timer: ReturnType<typeof setInterval> | undefined;

/** Adds the rows to the master data in batches so progress is visible. Lives outside the dialog, so "Run in background" keeps going. */
export function startImport(rows: IncomingMaterial[], fileName: string) {
  stopTimer();
  const batch = Math.max(1, Math.ceil(rows.length / TICKS));
  let at = 0;
  jobStore.setState({ status: 'running', fileName, total: rows.length, done: 0 });
  timer = setInterval(() => {
    masterDataStore.getState().addMaterials(rows.slice(at, at + batch));
    at = Math.min(rows.length, at + batch);
    jobStore.setState({ done: at });
    if (at >= rows.length) {
      stopTimer();
      jobStore.setState({ status: 'done' });
      const d = copy.progress.done(rows.length);
      notify.success(d.title, d.body, 'import-done');
    }
  }, TICK_MS);
}
export function cancelImport() {
  if (jobStore.getState().status !== 'running') return;
  stopTimer();
  jobStore.setState({ status: 'cancelled' });
  const c = copy.progress.cancelled(jobStore.getState().done);
  notify.info(c.title, c.body, 'import-cancelled');
}
export const resetImport = () => {
  stopTimer();
  jobStore.setState(IDLE);
};
function stopTimer() {
  if (timer) clearInterval(timer);
  timer = undefined;
}

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
let pending: IncomingMaterial[] = [];

/**
 * Adds the rows to the master data with visible progress. The list is updated ONCE (when the import ends or is cancelled, with what was done by then): updating a list of tens
 * of thousands of materials re-renders and re-saves all of it, so doing it per batch made the page stutter. Lives outside the dialog, so "Run in background" keeps going.
 */
export function startImport(rows: IncomingMaterial[], fileName: string) {
  stopTimer();
  pending = rows;
  const batch = Math.max(1, Math.ceil(rows.length / TICKS));
  let at = 0;
  jobStore.setState({ status: 'running', fileName, total: rows.length, done: 0 });
  timer = setInterval(() => {
    at = Math.min(rows.length, at + batch);
    jobStore.setState({ done: at });
    if (at >= rows.length) {
      stopTimer();
      commit(rows.length);
      jobStore.setState({ status: 'done' });
      const d = copy.progress.done(rows.length);
      notify.success(d.title, d.body, 'import-done');
    }
  }, TICK_MS);
}
const commit = (n: number) => {
  if (n > 0) masterDataStore.getState().addMaterials(pending.slice(0, n));
  pending = [];
};
export function cancelImport() {
  if (jobStore.getState().status !== 'running') return;
  stopTimer();
  const done = jobStore.getState().done;
  commit(done);
  jobStore.setState({ status: 'cancelled' });
  const c = copy.progress.cancelled(done);
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

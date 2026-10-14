import type { RobotTelemetry } from '@/core/types';
import { detect } from './detect';
import type { Call, Candidate, Thresholds } from './types';

export interface ActionState { active: Call[]; log: Call[] }
const LOG_CAP = 500, REPEAT_WINDOW_MS = 12 * 3600_000;
/** A condition must be gone this long before its call resolves itself (a robot that stutters between waiting and moving must not open and close calls). */
export const CLEAR_AFTER_MS = 5000;
export const pad = (n: number) => `CALL-${String(n).padStart(3, '0')}`;
const sig = (c: Pick<Call, 'kind' | 'place' | 'robots'>) => `${c.kind}|${c.place ?? c.robots[0]}`;

/**
 * The life of the calls (pure, no React): every look at the floor either opens a call, keeps one, or lets one resolve itself once its cause is gone.
 * A person can take a call (acknowledge), give it back, or resolve it; a call resolved by hand does not come back until its cause has cleared once.
 */
export class ActionCenterEngine {
  state: ActionState; private seq = 0; private waitStart = new Map<string, number>(); private missing = new Map<string, number>(); private suppressed = new Set<string>();
  constructor(log: Call[] = [], private onChange: (s: ActionState) => void = () => {}) {
    this.state = { active: [], log }; this.seq = Math.max(0, ...log.map((c) => +c.id.slice(5) || 0));
  }
  private emit(active = this.state.active, log = this.state.log) { this.state = { active, log }; this.onChange(this.state); }

  ingest(robots: RobotTelemetry[], now: number, th: Thresholds) {
    for (const r of robots) { if (r.state === 'waiting') { if (!this.waitStart.has(r.id)) this.waitStart.set(r.id, now); } else this.waitStart.delete(r.id); }
    const found = new Map<string, Candidate>(); for (const c of detect(robots, (id) => (now - (this.waitStart.get(id) ?? now)) / 1000, th)) found.set(c.key, c);
    let active = this.state.active.slice(), log = this.state.log, changed = false;
    for (const k of [...this.suppressed]) if (!found.has(k)) this.suppressed.delete(k);
    for (const [key, c] of found) {
      this.missing.delete(key); if (this.suppressed.has(key)) continue;
      const i = active.findIndex((a) => a.key === key);
      if (i >= 0) {
        const a = active[i]; const severity = a.severity === 'critical' || c.severity === 'critical' ? 'critical' : 'warn';
        if (a.severity !== severity || a.reason !== c.reason || a.title !== c.title || a.place !== c.place) { active[i] = { ...a, severity, reason: c.reason, title: c.title, place: c.place }; changed = true; }
      } else {
        const repeats = [...active, ...log].filter((x) => sig(x) === sig(c) && now - x.openedAt < REPEAT_WINDOW_MS).length;
        active = [...active, { ...c, id: pad(++this.seq), openedAt: now, status: 'open', repeats }]; changed = true;
      }
    }
    for (const a of active.slice()) {
      if (found.has(a.key)) continue;
      const since = this.missing.get(a.key) ?? now; this.missing.set(a.key, since);
      if (now - since >= CLEAR_AFTER_MS) { this.missing.delete(a.key); active = active.filter((x) => x !== a); log = this.finish(log, { ...a, status: 'resolved', resolvedAt: now, resolvedBy: a.claimedBy ?? 'Cleared on its own', resolution: a.claimedBy ? 'Cleared' : 'Cleared on its own' }); changed = true; }
    }
    if (changed) this.emit(active, log);
  }
  private finish(log: Call[], c: Call): Call[] { return [c, ...log].slice(0, LOG_CAP); }
  private patch(id: string, f: (c: Call) => Call) { const active = this.state.active.map((c) => (c.id === id ? f(c) : c)); this.emit(active); }

  acknowledge(id: string, who: string, now = Date.now()) { this.patch(id, (c) => (c.status === 'resolved' ? c : { ...c, status: 'acknowledged', claimedBy: who, claimedAt: now })); }
  release(id: string) { this.patch(id, (c) => ({ ...c, status: 'open', claimedBy: undefined, claimedAt: undefined })); }
  resolve(id: string, who: string, resolution: string, now = Date.now()) {
    const c = this.state.active.find((x) => x.id === id); if (!c) return;
    this.suppressed.add(c.key); this.missing.delete(c.key);
    this.emit(this.state.active.filter((x) => x !== c), this.finish(this.state.log, { ...c, status: 'resolved', resolvedAt: now, resolvedBy: who, resolution }));
  }
  /** The scope or the feed restarted: what was open is no longer known (the log stays). */
  clearActive() { this.waitStart.clear(); this.missing.clear(); this.suppressed.clear(); this.emit([]); }
}

const cell = (v: string | number | undefined) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** The resolved calls as CSV (for a shift report). Times are ISO strings; "Waited" is the seconds between opening and resolving. */
export function logToCsv(log: Call[], fleetName: (liveId: string) => string): string {
  const head = ['Call', 'Opened', 'Resolved', 'Waited (s)', 'Kind', 'Severity', 'Robots', 'Fleet', 'Place', 'What happened', 'Handled by', 'Resolution', 'Repeats'];
  const rows = log.map((c) => [c.id, new Date(c.openedAt).toISOString(), c.resolvedAt ? new Date(c.resolvedAt).toISOString() : '', c.resolvedAt ? Math.round((c.resolvedAt - c.openedAt) / 1000) : '', c.kind, c.severity, c.robots.join(' '), fleetName(c.fleetId), c.place ?? '', c.reason, c.resolvedBy ?? '', c.resolution ?? '', c.repeats]);
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\n');
}

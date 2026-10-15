import { connectionErrors } from '../model/validate';
import type { ConnectionDef } from '../model/types';
import { localized } from '@/i18n';

const misc = localized('misc').settings;

/**
 * How a connection is checked and synced. Today a MOCK (no network): it checks the values are complete and well formed and answers after a short wait, so the page behaves like
 * the real thing. A real implementation (calling the Fleet Manager / MES) replaces `connectionTester` and nothing else changes.
 */
export interface ConnectionTester {
  test(def: ConnectionDef, values: Record<string, string>): Promise<{ ok: boolean; message: string }>;
  /** Starts a sync and answers with the time it finished. */
  sync(def: ConnectionDef): Promise<number>;
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockTester = (delayMs = 700): ConnectionTester => ({
  async test(def, values) {
    await wait(delayMs);
    const bad = connectionErrors(def, values);
    const key = Object.keys(bad)[0];
    if (key) return { ok: false, message: `${def.fields.find((f) => f.key === key)!.label}: ${bad[key]}` };
    const down = def.fields.find((f) => /\.invalid\b|unreachable/i.test(values[f.key] ?? ''));
    return down
      ? { ok: false, message: misc.tester.noAnswer(values[down.key]) }
      : { ok: true, message: misc.tester.reachable };
  },
  async sync() {
    await wait(delayMs);
    return Date.now();
  },
});
export let connectionTester: ConnectionTester = mockTester();
export const setConnectionTester = (t: ConnectionTester) => {
  connectionTester = t;
}; // swap in a real one (or a fast one in tests)

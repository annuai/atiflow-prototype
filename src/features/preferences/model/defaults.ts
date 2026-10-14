import type { AlertPrefs, Preferences } from './types';

export const DEFAULT_ALERTS: AlertPrefs = { blocked: true, fault: true, stuck: true, battery: true, notifyAfterS: 90, waitWarnS: 45, waitUrgentS: 120, batteryLow: 25 };
export const DEFAULT_PREFERENCES: Preferences = { alerts: DEFAULT_ALERTS, startPage: 'last', defaultFleet: 'all' };

/** Saved preferences filled up with the defaults, so a preference added later has a value for people who saved before. */
export const withDefaults = (p?: Partial<Preferences> | null): Preferences => ({
  alerts: { ...DEFAULT_ALERTS, ...(p?.alerts ?? {}) }, startPage: p?.startPage ?? DEFAULT_PREFERENCES.startPage, defaultFleet: p?.defaultFleet ?? DEFAULT_PREFERENCES.defaultFleet,
});

/** Problems with a set of preferences by field; the urgent wait must not come before the first warning. */
export function validatePreferences(p: Preferences): Record<string, string> {
  const e: Record<string, string> = {}; if (p.alerts.waitUrgentS < p.alerts.waitWarnS) e.waitUrgentS = 'Urgent must be later than the first warning'; return e;
}
export const SECONDS_OPTIONS = [30, 45, 60, 90, 120, 180, 300];
export const BATTERY_OPTIONS = [15, 20, 25, 30, 40];
export const secondsLabel = (s: number) => (s < 60 ? `${s} seconds` : s === 60 ? '1 minute' : s % 60 === 0 ? `${s / 60} minutes` : `${Math.floor(s / 60)} min ${s % 60} s`);

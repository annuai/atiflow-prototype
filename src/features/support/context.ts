import { store as appStore } from '@/core/store';
import { authStore } from '@/features/auth';
import { settingsStore } from '@/features/settings';
import { FALLBACK_ROBOTS } from './data/mockSupportData';
import type { SupportContext } from './types';

export const ATI_FLOW_VERSION = '4.0';
export const FIRMWARE_VERSION = '3.2.1';
/** PLACEHOLDER customer account until the customer record exists. */
export const ACCOUNT = 'Ati Demo Customer';

const deviceLabel = () => {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const os = /iPad|Tablet/.test(ua) ? 'tablet' : /iPhone|Android.*Mobile/.test(ua) ? 'phone' : 'computer';
  return `${browser} on a ${os}`;
};
/**
 * What goes along with a ticket, built when the person starts one (and shown to them in "Included info"): who and where they are, the page, the robot and trip in view, current alerts and
 * versions. Robot firmware is a placeholder constant until robots report theirs here.
 */
export function buildContext(extra: { aiSummary?: string } = {}): SupportContext {
  const user = authStore.getState().user;
  const app = appStore.getState();
  const robots = Object.values(app.robots);
  const selected = app.selectedId ?? undefined;
  const alerts = robots.flatMap((r) => (r.alerts ?? []).map((a) => `${r.id}: ${a.msg}`)).slice(0, 5);
  return {
    user: { name: user?.name ?? 'Unknown', username: user?.username ?? '', role: user?.role ?? '' },
    site: settingsStore.getState().general.siteName,
    account: ACCOUNT,
    route: typeof location === 'undefined' ? '' : location.pathname,
    robotId: selected,
    alerts,
    atiFlowVersion: ATI_FLOW_VERSION,
    firmwareVersion: FIRMWARE_VERSION,
    device: deviceLabel(),
    aiSummary: extra.aiSummary,
  };
}
/** The robots the person may mean (for "which robot?"): what the floor reports, most relevant first. */
export function robotChoices(): string[] {
  const app = appStore.getState();
  const ids = Object.keys(app.robots).sort();
  if (!ids.length) return FALLBACK_ROBOTS;
  const sel = app.selectedId;
  return [...(sel ? [sel] : []), ...ids.filter((i) => i !== sel)].slice(0, 6);
}

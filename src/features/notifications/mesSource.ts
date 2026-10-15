import { masterDataStore } from '@/features/master-data';
import { localized } from '@/i18n';
import type { NewNotification, NotificationSource } from './types';

const L = localized('insights');
const MIN = 60_000;
/** The notifications a configurator saw before this session (placeholder for the MES history). */
export function mesBackfill(now: number): NewNotification[] {
  const stock = masterDataStore.getState().materials[0];
  return [
    {
      id: 'mes-seed-1',
      kind: 'mes',
      level: 'success',
      title: L.notifications.mes.newData,
      body: L.notifications.mes.orders(128),
      at: now - 14 * MIN,
    },
    {
      id: 'mes-seed-2',
      kind: 'stock',
      level: 'info',
      title: L.notifications.mes.newStock,
      body: stock ? `${stock.code} · ${stock.name}: ${L.notifications.mes.units(240)}` : L.notifications.mes.units(240),
      at: now - 55 * MIN,
    },
    {
      id: 'mes-seed-3',
      kind: 'mes',
      level: 'info',
      title: L.notifications.mes.refreshed,
      body: L.notifications.mes.noChanges,
      at: now - 3 * 60 * MIN,
    },
  ];
}
/** A new MES notification (stock added, or a data import), made up from Master Data so the names are real. */
export function mesNext(
  now: number,
  n: number,
  pick: (len: number) => number = (len) => Math.floor(Math.random() * len),
): NewNotification {
  const mats = masterDataStore.getState().materials;
  if (n % 2 === 0 && mats.length) {
    const m = mats[pick(mats.length)];
    return {
      id: `mes-stock-${now}`,
      kind: 'stock',
      level: 'info',
      title: L.notifications.mes.newStock,
      body: `${m.code} · ${m.name}: ${L.notifications.mes.units((1 + pick(9)) * 40)}`,
      at: now,
    };
  }
  return {
    id: `mes-data-${now}`,
    kind: 'mes',
    level: 'success',
    title: L.notifications.mes.newData,
    body: L.notifications.mes.orders(20 + pick(120)),
    at: now,
  };
}

/** Mock of the MES connection: a short history, then something new about once a minute. Replace with the real MES webhook / API. */
export const mesSource = (everyMs = 60_000): NotificationSource => ({
  start(emit) {
    emit(mesBackfill(Date.now()));
    let n = 0;
    const t = window.setInterval(() => emit([mesNext(Date.now(), n++)]), everyMs);
    return () => window.clearInterval(t);
  },
});

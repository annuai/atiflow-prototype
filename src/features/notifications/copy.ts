import { localized } from '@/i18n';

/** Text of this area: the catalogs in src/i18n/locales (one file per language). */
export const copy = localized('notifications');

export function timeAgo(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return copy.now;
  const m = Math.round(s / 60);
  if (m < 60) return copy.ago.min(Math.max(1, m));
  const h = Math.round(m / 60);
  return h < 24 ? copy.ago.hour(h) : copy.ago.day(Math.round(h / 24));
}

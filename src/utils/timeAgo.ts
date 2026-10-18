import { formatDate } from '@/i18n';
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['week', 604_800_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });
const long = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "2 min. ago", "yesterday", "3 wk. ago"... Anything under a minute is `justNow`. */
export function timeAgo(then: number, now: number, justNow = 'Just now'): string {
  const diff = Math.max(0, now - then);
  for (const [unit, ms] of UNITS) {
    if (diff >= ms) {
      const n = Math.floor(diff / ms);
      return (unit === 'day' && n === 1 ? long : rtf).format(-n, unit);
    }
  }
  return justNow;
}

/** For "last updated": "Just now", "12 min ago", "1 hour ago", "3 days ago", then the date ("28 Sep 2026"). */
export function lastUpdated(then: number, now: number): string {
  const s = Math.max(0, Math.floor((now - then) / 1000));
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d} ${d === 1 ? 'day' : 'days'} ago` : formatDate(then, 'date');
}

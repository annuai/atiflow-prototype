import { insights } from '../insightsCopy';
import type { RangeSelection, ResolvedRange } from './types';

const DAY = 86_400_000;
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayCount = (from: Date, to: Date) =>
  Math.max(1, Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY) + 1);
const short = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** Turns what the user picked into calendar days plus the words used for it ("Last 7 days", "previous 7 days"). A custom range without dates falls back to the last 7 days. */
export function resolveRange(sel: RangeSelection, now: Date = new Date()): ResolvedRange {
  const today = startOfDay(now);
  if (sel.preset === 'today')
    return {
      preset: 'today',
      from: today,
      to: today,
      days: 1,
      label: insights.reports.range.today,
      previousLabel: insights.reports.range.yesterday,
    };
  if (sel.preset === 'custom' && sel.from && sel.to) {
    const from = startOfDay(sel.from <= sel.to ? sel.from : sel.to),
      to = startOfDay(sel.from <= sel.to ? sel.to : sel.from),
      days = dayCount(from, to);
    return {
      preset: 'custom',
      from,
      to,
      days,
      label: days === 1 ? short(from) : `${short(from)} – ${short(to)}`,
      previousLabel: insights.reports.range.daysBefore(days),
    };
  }
  const days = sel.preset === '30d' ? 30 : 7;
  return {
    preset: sel.preset === 'custom' ? '7d' : sel.preset,
    from: addDays(today, 1 - days),
    to: today,
    days,
    label: insights.reports.range.last(days),
    previousLabel: insights.reports.range.previous(days),
  };
}

/** The period of the same length just before this one. */
export function previousRange(r: ResolvedRange): ResolvedRange {
  const to = addDays(r.from, -1),
    from = addDays(to, 1 - r.days);
  return { ...r, from, to, label: r.previousLabel, previousLabel: '' };
}

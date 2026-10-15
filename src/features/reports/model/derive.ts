import { HEADLINE, METRICS, METRIC_ORDER } from './metrics';
import type { MetricDef } from './metrics';
import type { Report } from './types';

/** Pure functions over a report: the change against the period before, what changed most, and the one-line verdict. */
const AVAILABILITY_TARGET = 85;       // % of the fleet that must be available (the board's definition of charging availability)
const WORSE_AT = 10, CRITICAL_AT = 25;       // % moves that count as slipping / seriously slipping / improving

/** Change against the previous period; `improved` says whether it moved to the better side of ITS metric (null = no meaningful change or nothing to compare). */
export function change(m: MetricDef, current: number | null, previous: number | null): { pct: number; improved: boolean | null } | null {
  if (current === null || previous === null || previous === 0) return null;
  const pct = ((current - previous) / previous) * 100; if (Math.abs(pct) < 0.5) return { pct: 0, improved: null };
  return { pct, improved: m.better === 'higher' ? pct > 0 : pct < 0 };
}

export interface Move { metric: MetricDef; pct: number; improved: boolean; from: number; to: number }
/** Every KPI that moved by at least 2% against the period before, biggest move first. Empty when there is nothing to compare with. */
export function moves(report: Report): Move[] {
  if (!report.previous) return [];
  return METRIC_ORDER.flatMap((id) => { const m = METRICS[id], c = change(m, report.fleet[id], report.previous![id]); return c && c.improved !== null && Math.abs(c.pct) >= 2 ? [{ metric: m, pct: c.pct, improved: c.improved, from: report.previous![id]!, to: report.fleet[id]! }] : []; })
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
}

export interface Verdict { level: 'ok' | 'warn' | 'critical'; headline: string; detail: string }
const list = (names: string[]) => (names.length <= 1 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
/** The one-line answer to "how did the fleet do?": availability below target and headline KPIs that clearly slipped decide the level. */
export function summary(report: Report): Verdict {
  const av = report.fleet.chargingAvailability, all = moves(report), vs = report.range.previousLabel;
  const slipped = all.filter((x) => !x.improved && HEADLINE.includes(x.metric.id) && Math.abs(x.pct) >= WORSE_AT);
  if (av !== null && av < AVAILABILITY_TARGET) return { level: 'critical', headline: 'Fleet availability is below target', detail: `Only ${Math.round(av)}% of the time were ${AVAILABILITY_TARGET}% of the robots available. Review the charging schedule.` };
  if (slipped.length) return { level: slipped.some((x) => Math.abs(x.pct) >= CRITICAL_AT) ? 'critical' : 'warn', headline: `${list(slipped.slice(0, 2).map((x) => x.metric.label))} slipped`, detail: `Compared with ${vs}: ${slipped.slice(0, 3).map((x) => `${x.metric.label} ${x.pct > 0 ? '+' : '−'}${Math.abs(x.pct).toFixed(0)}%`).join(', ')}.` };
  if (!report.previous) return { level: 'ok', headline: 'The fleet is running normally', detail: 'Comparison with the period before appears once there is history.' };
  const good = HEADLINE.filter((id) => { const c = change(METRICS[id], report.fleet[id], report.previous![id]); return c && c.improved !== false; }).length;
  return { level: 'ok', headline: 'The fleet is steady', detail: `${good} of ${HEADLINE.length} headline KPIs improved or held compared with ${vs}.` };
}

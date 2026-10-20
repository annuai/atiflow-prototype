import type { RangePreset, RangeSelection } from './types';

const PRESETS: readonly RangePreset[] = ['today', '7d', '30d', 'custom'];
const day = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDay = (s: string | null): Date | undefined => {
  const m = s && /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
};

/** The period of the Reports page in the address: `range=7d`, or `range=custom&from=2026-10-01&to=2026-10-07`. Today is the plain address. */
export function rangeToParams(sel: RangeSelection): Record<string, string> {
  if (sel.preset === 'today') return {};
  if (sel.preset === 'custom' && sel.from && sel.to) return { range: 'custom', from: day(sel.from), to: day(sel.to) };
  return { range: sel.preset === 'custom' ? '7d' : sel.preset };
}
export function rangeFromParams(params: URLSearchParams): RangeSelection {
  const preset = params.get('range') as RangePreset | null;
  if (!preset || !PRESETS.includes(preset) || preset === 'today') return { preset: 'today' };
  if (preset !== 'custom') return { preset };
  const from = parseDay(params.get('from')),
    to = parseDay(params.get('to'));
  return from && to ? { preset, from, to } : { preset: '7d' };
}

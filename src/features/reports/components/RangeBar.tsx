import { useEffect, useState } from 'react';
import { CalendarDate, getLocalTimeZone } from '@internationalized/date';
import { DateRangePicker } from '@/components/application/date-picker/date-range-picker';
import { SegmentedTabs } from '@/components/data/SegmentedTabs';
import { copy } from '../copy';
import type { RangePreset, RangeSelection } from '../model/types';

const toCalendar = (d: Date) => new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
const PRESETS: RangePreset[] = ['today', '7d', '30d', 'custom'];

/** Period picker (Today / Last 7 days / Last 30 days / Custom with the Untitled UI date range picker) and when the report was made. */
export function RangeBar({
  value,
  onChange,
  generatedAt,
}: {
  value: RangeSelection;
  onChange(v: RangeSelection): void;
  generatedAt: number | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const minutes = generatedAt === null ? 0 : Math.floor((now - generatedAt) / 60_000);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="max-w-full overflow-x-auto">
        <SegmentedTabs
          label={copy.range.label}
          value={value.preset}
          items={PRESETS.map((p) => ({ id: p, label: copy.range[p] }))}
          onChange={(preset) => onChange(preset === 'custom' ? { preset, from: value.from, to: value.to } : { preset })}
        />
      </div>
      {value.preset === 'custom' && (
        <DateRangePicker
          aria-label={copy.range.label}
          value={value.from && value.to ? { start: toCalendar(value.from), end: toCalendar(value.to) } : null}
          onChange={(r) =>
            r &&
            onChange({
              preset: 'custom',
              from: r.start.toDate(getLocalTimeZone()),
              to: r.end.toDate(getLocalTimeZone()),
            })
          }
        />
      )}
      <span className="ml-auto text-xs text-tertiary">{generatedAt === null ? '' : copy.range.updated(minutes)}</span>
    </div>
  );
}

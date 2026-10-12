import { LinkExternal01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { Select } from '@/components/base/select/select';
import { cx } from '@/utils/cx';
import { COMPARE_OPTIONS, longDate, type Bar, type Compare, type Delta, type PerformanceStats } from '../model';
import { Card, CardHeader } from './Card';

const delta = (pct: number, upIsGood = true): Delta => ({ pct, good: pct > 0 === upIsGood });

function Tile({ value, unit, label, delta: d, suffix }: { value: string | number; unit?: string; label: string; delta: Delta; suffix?: string }) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl bg-secondary p-3">
      <p className="text-display-xs font-semibold text-primary">{value}{suffix && <span className="text-md font-normal text-tertiary">{suffix}</span>}{unit && <span className="ml-1.5 text-xs font-normal text-tertiary">{unit}</span>}</p>
      <div><p className="text-xs text-tertiary">{label}</p><Badge size="sm" type="pill-color" color={d.good ? 'success' : 'error'} className="mt-2">{d.pct >= 0 ? '↑' : '↓'} {Math.abs(d.pct)}%</Badge></div>
    </div>
  );
}

/** Today's Performance: utilisation by hour (bars), trips, distance and downtime, compared with an earlier period. */
export function PerformanceCard({ now, bars, stats, compare, onCompare, onOpen }: { now: Date; bars: Bar[]; stats: PerformanceStats; compare: Compare; onCompare(c: Compare): void; onOpen(): void }) {
  const d = stats.deltas; const vs = compare === 'yesterday' ? 'yesterday' : 'last week';
  return (
    <Card>
      <CardHeader title={`Today's Performance (${longDate(now)})`}>
        <span className="hidden text-sm font-medium text-primary sm:inline">Compared to</span>
        <Select size="sm" aria-label="Compared to" className="w-36" selectedKey={compare} onSelectionChange={(k) => onCompare(k as Compare)} items={COMPARE_OPTIONS}>{(item) => <Select.Item {...item} />}</Select>
        <ButtonUtility size="sm" color="secondary" icon={LinkExternal01} tooltip="Open full report" aria-label="Open full report" onPress={onOpen} />
      </CardHeader>
      <div className="grid gap-4 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div className="flex flex-col justify-between rounded-xl bg-secondary p-3">
          <div role="img" aria-label="Robot utilisation by hour" className="flex h-36 items-end justify-between gap-1 px-3 pt-3">
            {bars.map((b) => (
              <div key={b.hour} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${b.label}: ${b.pct}%`}>
                <div className={cx('w-full max-w-5 rounded-sm', b.past ? 'bg-brand-solid' : 'bg-quaternary/40')} style={{ height: `${Math.max(4, b.pct) * 1.2}px` }} />
                <span className="text-[10px] leading-3 text-quaternary">{b.label}</span>
              </div>))}
          </div>
          <div className="mt-4"><p className="text-sm font-medium text-secondary">Robot Utilization</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-display-xs font-semibold text-primary">{stats.utilisation}%<Badge size="sm" type="pill-color" color="success">▲{d.utilisation}% vs. {vs}</Badge></p></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Tile value={stats.tripsDone} suffix={`/${stats.tripsPlanned}`} label="Trips Completed" delta={delta(d.done)} />
          <Tile value={stats.tripsCancelled} label="Trips Cancelled" delta={delta(d.cancelled, false)} />
          <Tile value={stats.distanceKm} unit="km" label="Distance Travelled" delta={delta(d.distance)} />
          <Tile value={stats.downtimeMin} unit="mins" label="Total Downtime" delta={delta(d.downtime, false)} />
        </div>
      </div>
    </Card>
  );
}

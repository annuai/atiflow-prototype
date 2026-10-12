import { cx } from '@/utils/cx';
import type { BatteryView } from '../data/types';
import { copy } from '../copy';
import { Card, CardTitle } from './Cards';

/** Battery spread of the fleet, the robots that are low, and which chargers and parking spots are taken. */
export function BatteryCard({ battery, tv, onLocate }: { battery: BatteryView; tv?: boolean; onLocate?(robotId: string): void }) {
  const max = Math.max(1, ...battery.buckets.map((b) => b.count));
  return (
    <Card tv={tv}>
      <CardTitle title={copy.battery.title} hint={`${copy.battery.average} ${battery.average}%`} />
      <ul className="flex flex-col gap-2">
        {battery.buckets.map((b) => <li key={b.label} className="grid grid-cols-[64px_1fr_20px] items-center gap-2 text-xs"><span className="text-tertiary">{b.label}</span><span className="h-2.5 overflow-hidden rounded-full bg-secondary"><i className={cx('block h-full rounded-full transition-[width] duration-500', b.low ? 'bg-error-solid' : 'bg-brand-solid')} style={{ width: `${(b.count / max) * 100}%` }} /></span><b className="text-right text-primary">{b.count}</b></li>)}
      </ul>
      <div className="mt-4 border-t border-secondary pt-3">
        <p className="mb-1.5 text-xs font-medium text-secondary">{copy.battery.low}</p>
        {battery.low.length ? <ul className="flex flex-wrap gap-1.5">{battery.low.map((r) => <li key={r.id}><button type="button" disabled={!onLocate} onClick={() => onLocate?.(r.id)} className="rounded-full border border-secondary bg-primary px-2.5 py-0.5 text-xs text-primary enabled:hover:bg-secondary">{r.id} · {r.battery}%{r.charging ? ` · ${copy.battery.charging}` : ''}</button></li>)}</ul>
          : <p className="text-xs text-tertiary">{copy.battery.none}</p>}
      </div>
      <div className="mt-4 border-t border-secondary pt-3 text-xs">
        <p className="mb-1.5 font-medium text-secondary">{copy.battery.chargers}</p>
        <ul className="flex flex-wrap gap-1.5">{battery.chargers.map((c) => <li key={c.id} className={cx('rounded-full px-2.5 py-0.5', c.robotId ? 'bg-success-primary text-fg-success-primary' : 'bg-secondary text-tertiary')}>{c.id} · {c.robotId ?? copy.battery.free}</li>)}</ul>
        <p className="mt-3 text-tertiary">{copy.battery.parking}: <b className="text-primary">{battery.parking.free} / {battery.parking.total}</b></p>
      </div>
    </Card>
  );
}

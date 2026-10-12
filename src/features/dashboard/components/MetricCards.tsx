import { Activity, AlertCircle, ArrowDown, ArrowUp, ClockRefresh, Truck01 } from '@untitledui/icons';
import { cx } from '@/utils/cx';
import type { Delta, MetricCard } from '../model';

const ICON = { active: Truck01, trips: ClockRefresh, attention: AlertCircle, health: Activity } as const;
const TONE = { active: 'text-success-primary', trips: 'text-success-primary', attention: 'text-error-primary', health: 'text-success-primary' } as const;

/** "+12%" / "-1%" with an arrow, green when the change is good news and red when it is not. */
export function DeltaText({ delta, className }: { delta: Delta; className?: string }) {
  const Arrow = delta.pct >= 0 ? ArrowUp : ArrowDown;
  return <span className={cx('inline-flex items-center gap-0.5 text-sm font-medium', delta.good ? 'text-success-primary' : 'text-error-primary', className)}><Arrow className="size-4" />{Math.abs(delta.pct)}%</span>;
}

/** The four numbers at the top: active robots, active trips, robots that need attention, fleet health. */
export function MetricCards({ cards }: { cards: MetricCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => { const Icon = ICON[c.id]; return (
        <div key={c.id} className="flex flex-col justify-between gap-5 rounded-xl border border-secondary bg-primary p-4 shadow-xs">
          <div className="flex items-start justify-between gap-2"><p className="text-sm text-secondary">{c.label}</p><Icon className={cx('size-5 shrink-0', TONE[c.id])} aria-hidden /></div>
          <div className="flex items-end justify-between gap-2"><p className="text-display-xs font-semibold text-primary">{c.value}</p><DeltaText delta={c.delta} /></div>
        </div>); })}
    </div>
  );
}

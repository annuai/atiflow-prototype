import type { FC } from 'react';
import { AlertTriangle, BatteryLow, ChevronDown, ChevronUp, Clock, Flag01, SlashCircle01, SwitchHorizontal01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { FleetName } from '@/components/data/FleetSelect';
import { useApp } from '@/core/store';
import { fmtDuration } from '@/features/dashboard/data/derive';
import { cx } from '@/utils/cx';
import { copy } from '../copy';
import type { Call, CallKind } from '../model/types';

export const KIND_ICON: Record<CallKind, FC<{ className?: string }>> = { blocked: SlashCircle01, fault: AlertTriangle, deadlock: SwitchHorizontal01, stuck: Clock, battery: BatteryLow, rule: Flag01 };
export const ageS = (c: Call, now: number) => Math.max(0, Math.round((now - c.openedAt) / 1000));

function RobotNow({ id }: { id: string }) {
  const r = useApp((s) => s.robots[id]); if (!r) return <li className="text-tertiary">{id}: no data</li>;
  return <li><b className="text-primary">{id}</b> · {r.state} · {Math.round(r.battery)}%{r.task ? ` · ${r.task.id} to ${r.task.to ?? '—'}` : ''}{r.waitsOn?.length ? ` · waits for ${r.waitsOn.join(', ')}` : ''}</li>;
}

interface Props { call: Call; now: number; me: string; expanded: boolean; onToggle(): void; canLocate: boolean; onLocate(): void; onTake(): void; onRelease(): void; onResolve(): void }
/** One call in the queue: the headline stays visible, the details open on a press. The buttons are the three things a person does: take it, give it back, resolve it. */
export function CallRow({ call: c, now, me, expanded, onToggle, canLocate, onLocate, onTake, onRelease, onResolve }: Props) {
  const Icon = KIND_ICON[c.kind]; const mine = c.claimedBy === me, taken = c.status === 'acknowledged'; const waited = ageS(c, now);
  return (
    <li className={cx('rounded-xl border border-secondary bg-primary shadow-xs border-l-4', c.severity === 'critical' ? 'border-l-error-solid' : 'border-l-warning-solid')}>
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
        <button type="button" className="flex min-w-0 flex-1 items-start gap-3 text-left sm:items-center" aria-expanded={expanded} onClick={onToggle}>
          <span className={cx('grid size-10 shrink-0 place-items-center rounded-full', c.severity === 'critical' ? 'bg-error-secondary text-fg-error-primary' : 'bg-warning-secondary text-fg-warning-primary')}><Icon className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2"><b className="text-sm text-primary">{c.title}</b><Badge size="sm" color={c.severity === 'critical' ? 'error' : 'warning'}>{copy.kind[c.kind]}</Badge>{c.repeats > 0 && <Badge size="sm" color="gray">{copy.row.repeat(c.repeats)}</Badge>}</span>
            <span className="block text-xs text-tertiary sm:truncate">{c.reason}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-tertiary"><FleetName id={c.fleetId} />{c.place && <span>{c.place}</span>}<span className={cx(waited >= 120 && !taken && 'font-semibold text-error-primary')}>Open for {fmtDuration(waited)}</span>{taken && <span className="font-medium text-brand-secondary">{mine ? copy.row.you : copy.row.takenBy(c.claimedBy ?? '')}</span>}</span>
          </span>
          {expanded ? <ChevronUp className="size-4 shrink-0 text-fg-quaternary" /> : <ChevronDown className="size-4 shrink-0 text-fg-quaternary" />}
        </button>
        <div className="flex w-full shrink-0 gap-2 *:flex-1 sm:w-auto sm:*:flex-none">
          {canLocate && <Button size="sm" color="secondary" onPress={onLocate}>{copy.row.locate}</Button>}
          {!taken && <Button size="sm" color="primary" onPress={onTake}>{copy.row.take}</Button>}
          {taken && mine && <Button size="sm" color="tertiary" onPress={onRelease}>{copy.row.release}</Button>}
          <Button size="sm" color={taken && mine ? 'primary' : 'secondary'} onPress={onResolve}>{copy.row.resolve}</Button>
        </div>
      </div>
      {expanded && (
        <div className="grid gap-4 border-t border-secondary px-4 py-3 text-sm sm:grid-cols-3">
          <div><p className="mb-1 text-xs font-semibold text-tertiary">{copy.row.why}</p><p className="text-secondary">{c.reason}</p></div>
          <div><p className="mb-1 text-xs font-semibold text-tertiary">{copy.row.fix}</p><p className="text-secondary">{c.suggestion}</p></div>
          <div><p className="mb-1 text-xs font-semibold text-tertiary">{copy.row.robot}</p><ul className="space-y-0.5 text-xs text-secondary">{c.robots.map((id) => <RobotNow key={id} id={id} />)}</ul></div>
        </div>
      )}
    </li>
  );
}

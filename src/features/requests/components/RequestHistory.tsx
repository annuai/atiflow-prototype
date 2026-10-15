import { useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardCheck } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { EmptyState } from '@/components/data/EmptyState';
import { SegmentedTabs } from '@/components/data/SegmentedTabs';
import { ConfirmDialog } from '@/components/modal/ConfirmDialog';
import { timeAgo } from '@/utils/timeAgo';
import { copy } from '../copy';
import { cancelRequest } from '../model/actions';
import { canCancel, currentStep, groupRequests, type Person } from '../model/rules';
import { useUserNames } from '../model/useUserNames';
import { STATUS, isActive } from '../model/status';
import type { TripRequest } from '../model/types';
import { RequestStatusBadge } from './RequestStatusBadge';

type Filter = 'active' | 'past' | 'all';
const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** One request: what, how many, its status (and trip / robot once there is one), a timeline on tap, and Cancel while a robot is not yet on its way. Cancel touches only this request. */
function RequestRow({ r, who, now, onCancel }: { r: TripRequest; who: Person; now: number; onCancel(): void }) {
  const [open, setOpen] = useState(false); const nameOf = useUserNames(); const step = currentStep(r);
  return (
    <li className="rounded-xl bg-secondary">
      <div className="flex flex-wrap items-center gap-3 p-3">
        <button type="button" className="flex min-w-0 flex-1 basis-56 items-center gap-3 text-left" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="min-w-0 flex-1"><span className="block font-semibold text-primary">{r.name}{r.qty > 0 && <span className="font-normal text-tertiary"> ×{r.qty}</span>}</span>
            <span className="block text-sm text-tertiary">{r.tripId && <><b className="font-semibold text-secondary">{r.tripId}</b> · </>}{r.code && `${r.code} · `}{r.workflowName}{r.robotId ? ` · ${r.robotId}` : ''}</span></span>
          {open ? <ChevronUp className="size-5 shrink-0 text-fg-quaternary" /> : <ChevronDown className="size-5 shrink-0 text-fg-quaternary" />}
        </button>
        <RequestStatusBadge status={r.status} size="lg" />
        {canCancel(r, who) && <Button size="lg" color="secondary-destructive" onPress={onCancel}>{copy.history.cancel}</Button>}
      </div>
      {open && (
        <div className="border-t border-secondary px-3 py-3 text-sm">
          <p className="mb-2 text-tertiary">{step ? copy.history.waitingFor(step.users.map(nameOf).join(', '), r.approvals.indexOf(step) + 1, r.approvals.length) : STATUS[r.status].hint}{r.note ? ` · ${r.note}` : ''}</p>
          <ol className="flex flex-col gap-1.5">{r.history.map((e, i) => <li key={i} className="flex gap-2 text-secondary"><span className="w-14 shrink-0 tabular-nums text-tertiary">{time(e.at)}</span><span>{STATUS[e.status].label}{e.by ? ` · ${copy.history.by(e.by)}` : ''}{e.note ? ` · ${e.note}` : ''}</span></li>)}</ol>
          <p className="mt-2 text-xs text-quaternary">{timeAgo(r.createdAt, now)}</p>
        </div>
      )}
    </li>
  );
}

/** Request history, grouped by the order they were made in. */
export function RequestHistory({ requests, who, now }: { requests: TripRequest[]; who: Person & { name: string }; now: number }) {
  const [filter, setFilter] = useState<Filter>('active'); const [cancelling, setCancelling] = useState<TripRequest | null>(null);
  const shown = requests.filter((r) => (filter === 'all' ? true : filter === 'active' ? isActive(r.status) : !isActive(r.status))); const groups = groupRequests(shown);
  return (
    <div className="flex flex-col gap-4">
      <div className="shrink-0"><SegmentedTabs<Filter> size="lg" value={filter} onChange={setFilter} label="Show" items={[{ id: 'active', label: copy.history.filters.active }, { id: 'past', label: copy.history.filters.past }, { id: 'all', label: copy.history.filters.all }]} /></div>
      {!groups.length ? <EmptyState icon={ClipboardCheck} title={requests.length ? copy.history.empty[filter === 'active' ? 'active' : 'past'] : copy.history.empty.title} subtext={requests.length ? undefined : copy.history.empty.hint} size="lg" />
        : groups.map((g) => (
          <section key={g.groupId} className="rounded-2xl border border-secondary bg-primary p-4 shadow-xs">
            <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-md font-semibold text-primary">{g.groupId}</h3><p className="text-sm text-tertiary">{copy.history.order(g.requests.length)} · {time(g.createdAt)} · {timeAgo(g.createdAt, now)}</p></header>
            <ul className="flex flex-col gap-2">{g.requests.map((r) => <RequestRow key={r.id} r={r} who={who} now={now} onCancel={() => setCancelling(r)} />)}</ul>
          </section>
        ))}
      <ConfirmDialog isOpen={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)} title={copy.history.cancelTitle(cancelling?.name ?? '')} description={copy.history.cancelBody} confirmLabel={copy.history.cancelConfirm} onConfirm={() => { if (cancelling) cancelRequest(cancelling.id, who); }} />
    </div>
  );
}

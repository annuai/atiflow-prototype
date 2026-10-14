import { useEffect, useState } from 'react';
import { CheckCircle } from '@untitledui/icons';
import { SegmentedTabs } from '@/components/data/SegmentedTabs';
import { notify } from '@/ui/toast';
import { timeAgo } from '@/utils/timeAgo';
import { ApprovalCard } from './components/ApprovalCard';
import { RejectSheet } from './components/RejectSheet';
import { RequestStatusBadge } from './components/RequestStatusBadge';
import { copy } from './copy';
import { useRequestsRunning } from './model/bridge';
import { canApprove } from './model/rules';
import { requestsStore, useRequests } from './model/store';
import type { TripRequest } from './model/types';
import { fleetIdOf, useOperator } from './model/useOperator';

type Tab = 'waiting' | 'activity';
/** Requests of other operators on my fleets that need approval (the Confirm step of their workflow), and what has happened to requests on my fleets. */
export function ApprovePage() {
  useRequestsRunning(); const me = useOperator(); const [tab, setTab] = useState<Tab>('waiting'); const [rejecting, setRejecting] = useState<TripRequest | null>(null); const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);
  const all = useRequests((s) => s.requests); const onMyFleets = all.filter((r) => { const id = fleetIdOf(r.fleet); return !!id && me.fleets.includes(id); });
  const waiting = onMyFleets.filter((r) => canApprove(r, me, fleetIdOf)).sort((a, b) => a.createdAt - b.createdAt); const activity = [...onMyFleets].sort((a, b) => b.createdAt - a.createdAt).slice(0, 60);
  const approve = (r: TripRequest) => { if (requestsStore.getState().approve(r.id, me, fleetIdOf)) notify.success(copy.approve.approved(r.name), `${r.id} · ${r.requestedByName}`, 'approve-ok'); };
  const reject = (r: TripRequest, reason: string) => { if (requestsStore.getState().reject(r.id, me, fleetIdOf, reason)) notify.info(copy.approve.rejected(r.name), reason, 'reject-ok'); setRejecting(null); };
  return (
    <div className="content">
      <div className="title-block"><div><h1>{copy.approve.title}</h1><p>{copy.approve.subtitle}</p></div></div>
      <div className="builder md-card"><div className="md-body !gap-4">
        <div className="shrink-0"><SegmentedTabs<Tab> size="lg" value={tab} onChange={setTab} label="Approve" items={[{ id: 'waiting', label: copy.approve.tabs.waiting(waiting.length) }, { id: 'activity', label: copy.approve.tabs.activity }]} /></div>
        {tab === 'waiting' ? (!waiting.length
          ? <div className="grid place-items-center py-16 text-center"><div><span className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-secondary text-fg-quaternary"><CheckCircle className="size-7" /></span><p className="text-lg font-medium text-primary">{copy.approve.empty.title}</p><p className="max-w-md text-sm text-tertiary">{copy.approve.empty.hint}</p></div></div>
          : <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">{waiting.map((r) => <ApprovalCard key={r.id} r={r} now={now} onApprove={() => approve(r)} onReject={() => setRejecting(r)} />)}</div>)
          : !activity.length ? <p className="py-10 text-center text-tertiary">{copy.approve.empty.activity}</p>
          : <ul className="flex flex-col gap-2">{activity.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-secondary bg-primary p-3">
              <div className="min-w-0 flex-1 basis-56"><p className="font-semibold text-primary">{r.name} <span className="font-normal text-tertiary">×{r.qty}</span></p><p className="text-sm text-tertiary">{r.id} · {r.requestedByName} · {r.fleet}{r.tripId ? ` · ${r.tripId}` : ''} · {timeAgo(r.createdAt, now)}</p></div>
              <RequestStatusBadge status={r.status} size="lg" /></li>))}</ul>}
      </div></div>
      <RejectSheet request={rejecting} onClose={() => setRejecting(null)} onReject={(reason) => rejecting && reject(rejecting, reason)} />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { TabPanelMotion } from '@/components/motion/TabPanelMotion';
import { CheckCircle, ClockRewind } from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import { SegmentedTabs } from '@/components/data/SegmentedTabs';
import { notify } from '@/ui/toast';
import { ApprovalCard } from './components/ApprovalCard';
import { DecisionRow } from './components/DecisionRow';
import { RejectSheet } from './components/RejectSheet';
import { copy } from './copy';
import { useRequestsRunning } from './model/bridge';
import { decisions } from './model/decisions';
import { canApprove } from './model/rules';
import { requestsStore, useRequests } from './model/store';
import type { TripRequest } from './model/types';
import { useOperator } from './model/useOperator';

type Tab = 'waiting' | 'history';
/** Requests of other operators on my fleets that need approval (the Confirm step of their workflow), and what has happened to requests on my fleets. */
export function ApprovePage() {
  useRequestsRunning();
  const me = useOperator();
  const [tab, setTab] = useState<Tab>('waiting');
  const [rejecting, setRejecting] = useState<TripRequest | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const all = useRequests((s) => s.requests);
  const waiting = all.filter((r) => canApprove(r, me)).sort((a, b) => a.createdAt - b.createdAt);
  const history = decisions(all, me); // every approval and rejection on steps I am an approval user of, or by me
  const approve = (r: TripRequest) => {
    if (requestsStore.getState().approve(r.id, me))
      notify.success(copy.approve.approved(r.name), `${r.id} · ${r.requestedByName}`, 'approve-ok');
  };
  const reject = (r: TripRequest, reason: string) => {
    if (requestsStore.getState().reject(r.id, me, reason))
      notify.info(copy.approve.rejected(r.name), reason, 'reject-ok');
    setRejecting(null);
  };
  return (
    <div className="content">
      <div className="title-block">
        <div>
          <h1>{copy.approve.title}</h1>
          <p>{copy.approve.subtitle}</p>
        </div>
      </div>
      <div className="builder md-card">
        <div className="md-body !gap-4">
          <div className="shrink-0">
            <SegmentedTabs<Tab>
              size="lg"
              value={tab}
              onChange={setTab}
              label="Approve"
              items={[
                { id: 'waiting', label: copy.approve.tabs.waiting(waiting.length) },
                { id: 'history', label: copy.approve.tabs.history },
              ]}
            />
          </div>
          <TabPanelMotion tabKey={tab} fill>
            {tab === 'waiting' ? (
              !waiting.length ? (
                <EmptyState
                  icon={CheckCircle}
                  tone="positive"
                  title={copy.approve.empty.title}
                  subtext={copy.approve.empty.hint}
                  size="lg"
                />
              ) : (
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
                  {waiting.map((r) => (
                    <ApprovalCard
                      key={r.id}
                      r={r}
                      now={now}
                      onApprove={() => approve(r)}
                      onReject={() => setRejecting(r)}
                    />
                  ))}
                </div>
              )
            ) : !history.length ? (
              <EmptyState
                icon={ClockRewind}
                title={copy.approve.empty.history}
                subtext={copy.approve.empty.historyHint}
                size="lg"
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {history.slice(0, 100).map((d) => (
                  <DecisionRow key={d.key} d={d} now={now} />
                ))}
              </ul>
            )}
          </TabPanelMotion>
        </div>
      </div>
      <RejectSheet
        request={rejecting}
        onClose={() => setRejecting(null)}
        onReject={(reason) => rejecting && reject(rejecting, reason)}
      />
    </div>
  );
}

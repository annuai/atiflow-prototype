import { useEffect, useState } from 'react';
import { CheckCircle } from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import { notify } from '@/ui/toast';
import { ApprovalCard } from './components/ApprovalCard';
import { RejectSheet } from './components/RejectSheet';
import { copy } from './copy';
import { useRequestsRunning } from './model/bridge';
import { canApprove } from './model/rules';
import { requestsStore, useRequests } from './model/store';
import type { TripRequest } from './model/types';
import { useOperator } from './model/useOperator';
import { Page, PageCard, PageCardBody, PageHeader } from '@/components/page';

/** Requests of other operators on my fleets that wait for my approval (the Confirm step of their workflow). What has been decided is in History. */
export function ApprovePage() {
  useRequestsRunning();
  const me = useOperator();
  const [rejecting, setRejecting] = useState<TripRequest | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const all = useRequests((s) => s.requests);
  const waiting = all.filter((r) => canApprove(r, me)).sort((a, b) => a.createdAt - b.createdAt);
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
    <Page>
      <PageHeader title={copy.approve.title} subtitle={copy.approve.subtitle} />
      <PageCard>
        <PageCardBody>
          {!waiting.length ? (
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
          )}
        </PageCardBody>
      </PageCard>
      <RejectSheet
        request={rejecting}
        onClose={() => setRejecting(null)}
        onReject={(reason) => rejecting && reject(rejecting, reason)}
      />
    </Page>
  );
}

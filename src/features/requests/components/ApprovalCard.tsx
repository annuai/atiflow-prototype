import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { timeAgo } from '@/utils/timeAgo';
import { copy } from '../copy';
import type { TripRequest } from '../model/types';

/** A request that waits for approval: what, how many, who asked, and two big buttons. */
export function ApprovalCard({ r, now, onApprove, onReject }: { r: TripRequest; now: number; onApprove(): void; onReject(): void }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-secondary bg-primary p-4 shadow-xs">
      <header><h3 className="text-lg font-semibold leading-snug text-primary">{r.name} <span className="font-normal text-tertiary">×{r.qty}</span></h3><p className="font-mono text-sm text-tertiary">{r.code}</p></header>
      <div className="flex flex-wrap items-center gap-2">{r.group && <Badge size="md" color="gray">{r.group}</Badge>}<Badge size="md" color="warning">{r.id}</Badge></div>
      <p className="text-sm text-secondary">{copy.approve.requestedBy(r.requestedByName, timeAgo(r.createdAt, now))}</p>
      <p className="text-xs text-tertiary">{r.workflowName} · {r.fleet}</p>
      <footer className="mt-auto flex gap-3 pt-1"><Button size="xl" color="secondary-destructive" className="flex-1" onPress={onReject}>{copy.approve.reject}</Button><Button size="xl" color="primary" className="flex-1" onPress={onApprove}>{copy.approve.approve}</Button></footer>
    </article>
  );
}

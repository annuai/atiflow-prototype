import { Badge } from '@/components/base/badges/badges';
import { timeAgo } from '@/utils/timeAgo';
import { copy } from '../copy';
import type { Decision } from '../model/decisions';
import { STATUS } from '../model/status';
import { RequestStatusBadge } from './RequestStatusBadge';

/** One line of the approval history: the trip and material, what was decided where and by whom, and where the request stands now. */
export function DecisionRow({ d, now }: { d: Decision; now: number }) {
  const time = new Date(d.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-secondary bg-primary p-3">
      <div className="min-w-0 flex-1 basis-60">
        <p className="font-semibold text-primary"><span className="text-secondary">{d.tripId}</span> · {d.code && `${d.code} · `}{d.name}{d.qty > 0 && <span className="font-normal text-tertiary"> ×{d.qty}</span>}</p>
        <p className="text-sm text-secondary">{copy.approve.decision.line(copy.approve.decision[d.outcome], d.by, d.step)}{d.note ? ` · ${d.note}` : ''}</p>
        <p className="text-xs text-tertiary">{time} · {timeAgo(d.at, now)} · {copy.approve.decision.requested(d.requestedByName)} · {d.requestId}</p>
      </div>
      <Badge size="lg" type="pill-color" color={d.outcome === 'approved' ? 'success' : 'error'}>{copy.approve.decision[d.outcome]}</Badge>
      {d.status !== d.outcome && STATUS[d.status] && <RequestStatusBadge status={d.status} size="lg" />}
    </li>
  );
}

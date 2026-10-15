import { useEffect, useMemo, useState } from 'react';
import { ClockRewind } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { EmptyState } from '@/components/data/EmptyState';
import { SegmentedTabs } from '@/components/data/SegmentedTabs';
import { copy } from '@/features/bookings/copy';
import { useBookingsRunning } from '@/features/bookings/model/bridge';
import { cancelBooking } from '@/features/bookings/model/actions';
import { canCancelBooking } from '@/features/bookings/model/rules';
import { useBookings } from '@/features/bookings/model/store';
import { RequestStatusBadge } from '@/features/requests/components/RequestStatusBadge';
import { useRequestsRunning } from '@/features/requests/model/bridge';
import { useRequests } from '@/features/requests/model/store';
import { useOperator } from '@/features/requests/model/useOperator';
import { timeAgo } from '@/utils/timeAgo';
import { historyEntries, type HistoryKind } from './entries';

type Filter = 'all' | HistoryKind;
const KIND_COLOR = { request: 'brand', approval: 'warning', trip: 'blue' } as const;
/** One list for a person's requests, approvals and booked trips, with a filter. The old per-page histories stay where they are. */
export function OperatorHistoryPage() {
  useRequestsRunning();
  useBookingsRunning();
  const me = useOperator();
  const [filter, setFilter] = useState<Filter>('all');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const requests = useRequests((s) => s.requests);
  const trips = useBookings((s) => s.trips);
  const all = useMemo(() => historyEntries(requests, trips, me), [requests, trips, me]);
  const shown = filter === 'all' ? all : all.filter((e) => e.kind === filter);
  const count = (k: Filter) => (k === 'all' ? all.length : all.filter((e) => e.kind === k).length);
  const h = copy.history;
  return (
    <div className="content">
      <div className="title-block">
        <div>
          <h1>{h.title}</h1>
          <p>{h.subtitle}</p>
        </div>
      </div>
      <div className="builder md-card">
        <div className="md-body !gap-4">
          <div className="shrink-0">
            <SegmentedTabs<Filter>
              size="lg"
              value={filter}
              onChange={setFilter}
              label={h.title}
              items={(['all', 'request', 'approval', 'trip'] as Filter[]).map((k) => ({
                id: k,
                label: `${h.filters[k]} (${count(k)})`,
              }))}
            />
          </div>
          {!shown.length ? (
            <EmptyState
              icon={ClockRewind}
              title={all.length ? h.none : h.empty.title}
              subtext={h.empty.hint}
              size="lg"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {shown.slice(0, 200).map((e) => {
                const trip = e.bookingId ? trips.find((t) => t.id === e.bookingId) : undefined;
                const when = new Date(e.at).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <li
                    key={e.key}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-secondary bg-primary p-3"
                  >
                    <div className="min-w-0 flex-1 basis-60">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-primary">
                        <Badge size="sm" type="pill-color" color={KIND_COLOR[e.kind]}>
                          {h.kinds[e.kind]}
                        </Badge>
                        <span>{e.title}</span>
                      </p>
                      <p className="text-sm text-secondary">{e.subtitle}</p>
                      <p className="text-xs text-tertiary">
                        {when} · {timeAgo(e.at, now)}
                      </p>
                    </div>
                    {e.outcome && (
                      <Badge size="lg" type="pill-color" color={e.outcome === 'approved' ? 'success' : 'error'}>
                        {e.outcome === 'approved' ? 'Approved' : 'Rejected'}
                      </Badge>
                    )}
                    {e.outcome ? (
                      e.status !== e.outcome && <RequestStatusBadge status={e.status} size="lg" />
                    ) : (
                      <RequestStatusBadge status={e.status} size="lg" />
                    )}
                    {trip && canCancelBooking(trip, me) && (
                      <Button size="lg" color="secondary" onPress={() => cancelBooking(trip.id, me)}>
                        {h.cancel}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

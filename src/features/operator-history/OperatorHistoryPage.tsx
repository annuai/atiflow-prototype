import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TabPanelMotion } from '@/components/motion/TabPanelMotion';
import { ClockRewind } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { EmptyState } from '@/components/data/EmptyState';
import { SegmentedTabs } from '@/components/data/SegmentedTabs';
import { copy, useBookingsRunning, cancelBooking, canCancelBooking, useBookings } from '@/features/bookings';
import {
  RequestCancelDialog,
  RequestStatusBadge,
  canCancel,
  useRequestsRunning,
  useRequests,
  useOperator,
  type TripRequest,
} from '@/features/requests';
import { timeAgo } from '@/utils/timeAgo';
import { HistoryDetail } from './HistoryDetail';
import { t } from './text';
import { historyEntries, type HistoryKind } from './entries';

type Filter = 'all' | HistoryKind;
const KIND_COLOR = { request: 'brand', approval: 'warning', trip: 'blue' } as const;
/** One list for a person's requests, approvals and booked trips, with a filter. The old per-page histories stay where they are. */
export function OperatorHistoryPage() {
  useRequestsRunning();
  useBookingsRunning();
  const me = useOperator();
  const [filter, setFilter] = useState<Filter>('all');
  const [cancelling, setCancelling] = useState<TripRequest | null>(null);
  const [opened, setOpened] = useState<string | null>(() => new URLSearchParams(window.location.search).get('open')); // search opens an item's details
  const { search: urlSearch } = useLocation();
  const [seenOpen, setSeenOpen] = useState(urlSearch);
  if (seenOpen !== urlSearch) {
    setSeenOpen(urlSearch);
    const v = new URLSearchParams(urlSearch).get('open');
    if (v) setOpened(v);
  }
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
              items={(['all', 'request', 'trip', 'approval'] as Filter[]).map((k) => ({
                id: k,
                label: `${h.filters[k]} (${count(k)})`,
              }))}
            />
          </div>
          <TabPanelMotion tabKey={filter} fill>
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
                  const req = e.requestId ? requests.find((r) => r.id === e.requestId) : undefined;
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
                      <button
                        type="button"
                        className="min-w-0 flex-1 basis-60 rounded-lg text-left outline-focus-ring focus-visible:outline-2"
                        aria-label={h.detail.open(e.title)}
                        onClick={() => setOpened(e.key)}
                      >
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
                      </button>
                      {e.outcome && (
                        <Badge size="lg" type="pill-color" color={e.outcome === 'approved' ? 'success' : 'error'}>
                          {t.history[e.outcome]}
                        </Badge>
                      )}
                      {e.outcome ? (
                        e.status !== e.outcome && <RequestStatusBadge status={e.status} size="lg" />
                      ) : (
                        <RequestStatusBadge status={e.status} size="lg" />
                      )}
                      {req && canCancel(req, me) && (
                        <Button size="lg" color="secondary" onPress={() => setCancelling(req)}>
                          {h.cancelRequest}
                        </Button>
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
          </TabPanelMotion>
        </div>
      </div>
      {(() => {
        const e = all.find((x) => x.key === opened);
        return (
          <HistoryDetail
            title={e?.title ?? ''}
            request={e?.requestId ? requests.find((r) => r.id === e.requestId) : undefined}
            trip={e?.bookingId ? trips.find((t) => t.id === e.bookingId) : undefined}
            onClose={() => setOpened(null)}
          />
        );
      })()}
      <RequestCancelDialog request={cancelling} who={me} onClose={() => setCancelling(null)} />
    </div>
  );
}

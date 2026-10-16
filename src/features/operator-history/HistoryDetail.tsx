import type { ReactNode } from 'react';
import { BottomSheet } from '@/components/modal/BottomSheet';
import { copy, type BookedTrip } from '@/features/bookings';
import { RequestStatusBadge, STATUS, useUserNames, type StatusEvent, type TripRequest } from '@/features/requests';

const stamp = (at: number) =>
  new Date(at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <dt className="w-32 shrink-0 text-tertiary">{label}</dt>
      <dd className="min-w-0 flex-1 text-primary">{children}</dd>
    </div>
  );
}

function Timeline({ events }: { events: StatusEvent[] }) {
  const d = copy.history.detail;
  return (
    <section className="mt-4">
      <h3 className="mb-2 text-sm font-semibold text-primary">{d.timeline}</h3>
      <ol className="flex flex-col gap-1.5 text-sm">
        {events.map((e, i) => (
          <li key={i} className="flex gap-3 text-secondary">
            <span className="w-28 shrink-0 text-tertiary tabular-nums">{stamp(e.at)}</span>
            <span>
              {STATUS[e.status].label}
              {e.by ? ` · ${d.by(e.by)}` : ''}
              {e.note ? ` · ${e.note}` : ''}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** What a history entry is now: its status in words, where it waits (and with whom), who and what it involves, and every step it went through. A request (material, called saved trip or one the person approved) or a trip booked by the person. */
export function HistoryDetail({
  title,
  request,
  trip,
  onClose,
}: {
  title: string;
  request?: TripRequest;
  trip?: BookedTrip;
  onClose(): void;
}) {
  const d = copy.history.detail;
  const nameOf = useUserNames();
  const item = request ?? trip;
  const status = item?.status;
  return (
    <BottomSheet
      isOpen={!!item}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      subtitle={status ? STATUS[status].hint : undefined}
    >
      {item && status && (
        <>
          <dl className="divide-y divide-secondary">
            <Row label={d.status}>
              <RequestStatusBadge status={status} size="md" />
            </Row>
            <Row label={d.trip}>{item.tripId}</Row>
            {request && <Row label={d.request}>{request.id}</Row>}
            <Row label={d.robot}>
              {item.robotId ?? (trip ? trip.robotLabel : (request?.robotType ?? d.robotNone))}
              {item.robotId && trip ? ` · ${trip.robotLabel}` : ''}
            </Row>
            <Row label={d.fleet}>{item.fleet}</Row>
            {request && <Row label={d.workflow}>{request.workflowName}</Row>}
            <Row label={d.requestedBy}>{request ? request.requestedByName : trip?.bookedByName}</Row>
            <Row label={d.route}>{request ? request.legs.join(' → ') : `${trip?.fromName} → ${trip?.toName}`}</Row>
          </dl>
          {request && request.approvals.length > 0 && (
            <section className="mt-4">
              <h3 className="mb-2 text-sm font-semibold text-primary">{d.approvals}</h3>
              <ul className="flex flex-col gap-1.5 text-sm text-secondary">
                {request.approvals.map((a, i) => (
                  <li key={i}>
                    <span className="font-medium text-primary">{d.step(i + 1, request.approvals.length)}</span>
                    {' · '}
                    {a.by
                      ? `${d.done(a.by)}${a.at ? ` · ${stamp(a.at)}` : ''}`
                      : request.status === 'rejected' || request.status === 'cancelled'
                        ? a.users.map(nameOf).join(', ')
                        : d.waiting(a.users.map(nameOf).join(', '))}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <Timeline events={item.history} />
        </>
      )}
    </BottomSheet>
  );
}

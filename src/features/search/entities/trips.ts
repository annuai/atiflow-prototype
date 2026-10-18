import { Route } from '@untitledui/icons';
import { fleetDirectory } from '@/data/fleetDirectory';
import { store } from '@/core/store';
import { bookingsStore, type BookedTrip } from '@/features/bookings';
import { STATUS, requestsStore, type TripRequest } from '@/features/requests';
import { copy as floor } from '@/ui/copy';
import { copy } from '../copy';
import type { SearchEntity } from '../types';
import { fleetNameOf, focusUrl, meta, seesFleet } from './helpers';

/** One trip as search sees it: running on the floor (supervisors), or booked / requested by the person (operators). */
type Row =
  | { kind: 'live'; id: string; robotId: string; from: string; to: string; fleet: string; state: string; at: number }
  | { kind: 'booked'; t: BookedTrip }
  | { kind: 'request'; r: TripRequest };

const bookedUrl = (t: BookedTrip) => `/operator/history?open=${encodeURIComponent(`trip:${t.id}`)}`;
const requestUrl = (r: TripRequest) => `/operator/history?open=${encodeURIComponent(`req:${r.id}`)}`;

export const tripEntity: SearchEntity<Row> = {
  type: 'trip',
  label: () => copy.types.trip,
  icon: Route,
  permission: (ctx) => ctx.can('supervisor.live-floor') || ctx.can('operator.book-trip'),
  load: (ctx) => {
    const rows: Row[] = [];
    if (ctx.can('operator.book-trip')) {
      const me = ctx.user.username;
      for (const t of bookingsStore.getState().trips) if (t.bookedBy === me) rows.push({ kind: 'booked', t });
      for (const r of requestsStore.getState().requests) if (r.requestedBy === me) rows.push({ kind: 'request', r });
    }
    if (ctx.can('supervisor.live-floor')) {
      const s = store.getState();
      for (const r of Object.values(s.robots))
        if (r.task && r.task.type !== 'park' && seesFleet(ctx.liveFleets, r.fleetId))
          rows.push({
            kind: 'live',
            id: r.task.id,
            robotId: r.id,
            from: r.task.origin ?? r.task.from ?? '',
            to: r.task.to ?? '',
            fleet: fleetNameOf(s.fleets, r.fleetId),
            state: r.state,
            at: r.ts,
          });
    }
    return rows;
  },
  fields: [
    { get: (x) => (x.kind === 'live' ? x.id : x.kind === 'booked' ? x.t.tripId : x.r.tripId), weight: 4 },
    {
      get: (x) =>
        x.kind === 'live'
          ? `${x.robotId} ${x.from} ${x.to}`
          : x.kind === 'booked'
            ? `${x.t.fromName} ${x.t.toName} ${x.t.robotLabel} ${x.t.robotId ?? ''}`
            : `${x.r.name} ${x.r.code} ${x.r.workflowName}`,
      weight: 2,
    },
    {
      get: (x) =>
        x.kind === 'live' ? x.fleet : x.kind === 'booked' ? STATUS[x.t.status].label : STATUS[x.r.status].label,
      weight: 1,
    },
  ],
  id: (x) => (x.kind === 'live' ? x.id : x.kind === 'booked' ? x.t.tripId : x.r.tripId),
  home: ['supervisor', 'operator'],
  toResult: (x) => {
    if (x.kind === 'live')
      return {
        title: x.id,
        subtitle: `${x.robotId} → ${x.to}`,
        url: focusUrl('robot', x.robotId),
        live: { robotId: x.robotId },
        at: x.at,
        facets: { status: x.state, fleet: x.fleet },
        metadata: [
          ...meta(copy.meta.robot, x.robotId),
          ...meta(copy.meta.status, floor.states[x.state as keyof typeof floor.states] ?? x.state),
          ...meta(copy.meta.fleet, x.fleet),
        ],
      };
    if (x.kind === 'booked') {
      const t = x.t;
      return {
        title: t.tripId,
        subtitle: `${t.fromName} → ${t.toName}`,
        url: bookedUrl(t),
        at: t.history.at(-1)?.at ?? t.createdAt,
        facets: { status: t.status, fleet: fleetDirectory.nameOf(t.fleet) },
        metadata: [
          ...meta(copy.meta.status, STATUS[t.status].label),
          ...meta(copy.meta.robot, t.robotId ?? t.robotLabel),
          ...meta(copy.meta.fleet, fleetDirectory.nameOf(t.fleet)),
        ],
      };
    }
    const r = x.r;
    return {
      title: r.tripId,
      subtitle: r.qty > 0 ? `${r.name} ×${r.qty}` : r.name,
      url: requestUrl(r),
      at: r.history.at(-1)?.at ?? r.createdAt,
      facets: { status: r.status, fleet: fleetDirectory.nameOf(r.fleet) },
      metadata: [
        ...meta(copy.meta.status, STATUS[r.status].label),
        ...meta(copy.meta.fleet, fleetDirectory.nameOf(r.fleet)),
        ...meta(copy.meta.robot, r.robotId),
      ],
    };
  },
  actions: (x, ctx) => {
    if (x.kind === 'live')
      return [
        { id: 'track', label: copy.actions.track, kind: 'navigate', url: focusUrl('robot', x.robotId), primary: true },
        ...(ctx.can('supervisor.live-floor')
          ? [
              {
                id: 'robot',
                label: copy.actions.openRobot,
                kind: 'navigate' as const,
                url: focusUrl('robot', x.robotId),
              },
            ]
          : []),
      ];
    const url = x.kind === 'booked' ? bookedUrl(x.t) : requestUrl(x.r);
    const cancellable = x.kind === 'booked' ? STATUS[x.t.status].cancellable : STATUS[x.r.status].cancellable;
    return [
      { id: 'open', label: copy.actions.openTrip, kind: 'navigate', url, primary: true },
      ...(cancellable
        ? [
            {
              id: 'cancel',
              label: copy.actions.cancel,
              kind: 'command' as const,
              command:
                x.kind === 'booked'
                  ? { kind: 'cancel-booking' as const, id: x.t.id }
                  : { kind: 'cancel-request' as const, id: x.r.id },
            },
          ]
        : []),
    ];
  },
};

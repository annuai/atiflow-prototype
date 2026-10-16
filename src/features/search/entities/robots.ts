import { Truck01 } from '@untitledui/icons';
import { store } from '@/core/store';
import type { RobotTelemetry } from '@/core/types';
import { robotTypeById } from '@/data/robotTypes';
import { copy as floor } from '@/ui/copy';
import { copy } from '../copy';
import type { SearchEntity } from '../types';
import { fleetNameOf, focusUrl, meta, seesFleet } from './helpers';

const TONE: Record<string, 'success' | 'warning' | 'error' | 'brand' | 'gray'> = {
  moving: 'brand',
  working: 'warning',
  charging: 'success',
  blocked: 'error',
  error: 'error',
  offline: 'gray',
  waiting: 'warning',
  idle: 'gray',
};
/** The robots on the floor right now (live): supervisors only (operators do not search robots). */
export const robotEntity: SearchEntity<RobotTelemetry> = {
  type: 'robot',
  label: () => copy.types.robot,
  icon: Truck01,
  permission: (ctx) => ctx.can('supervisor.live-floor'),
  load: (ctx) => Object.values(store.getState().robots).filter((r) => seesFleet(ctx.liveFleets, r.fleetId)),
  fields: [
    { get: (r) => r.id, weight: 4 },
    { get: (r) => `${robotTypeById(r.model).label} ${r.model}`, weight: 1.5 },
    { get: (r) => `${floor.states[r.state] ?? r.state} ${r.state}`, weight: 1 },
    { get: (r) => fleetNameOf(store.getState().fleets, r.fleetId), weight: 1 },
    { get: (r) => r.task?.id ?? '', weight: 2 },
  ],
  id: (r) => r.id,
  home: ['supervisor'],
  boost: (r) => (r.state === 'error' || r.state === 'blocked' ? 4 : 0),
  toResult: (r) => ({
    title: r.id,
    subtitle: `${robotTypeById(r.model).label} · ${fleetNameOf(store.getState().fleets, r.fleetId)}`,
    url: focusUrl('robot', r.id),
    live: { robotId: r.id },
    facets: { status: r.state, fleet: fleetNameOf(store.getState().fleets, r.fleetId) },
    metadata: [
      ...meta(copy.meta.status, floor.states[r.state] ?? r.state, TONE[r.state]),
      ...meta(copy.meta.battery, `${Math.round(r.battery)}%`, r.battery < 25 ? 'error' : 'success'),
      ...meta(copy.meta.trip, r.task?.id),
    ],
  }),
  actions: (r, ctx) => [
    { id: 'locate', label: copy.actions.locate, kind: 'navigate', url: focusUrl('robot', r.id), primary: true },
    ...(r.task
      ? [{ id: 'track', label: copy.actions.viewTrip, kind: 'navigate' as const, url: focusUrl('robot', r.id) }]
      : []),
    ...(ctx.can('supervisor.live-floor') && r.state !== 'charging' && r.state !== 'offline'
      ? [
          {
            id: 'charger',
            label: copy.actions.charger,
            kind: 'command' as const,
            command: { kind: 'charger' as const, robotId: r.id },
          },
        ]
      : []),
  ],
};

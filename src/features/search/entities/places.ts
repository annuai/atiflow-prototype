import { MarkerPin01, Grid01 } from '@untitledui/icons';
import type { Station, Zone } from '@/core/types';
import { mapNow } from '@/features/workflow-builder';
import { copy } from '../copy';
import type { SearchEntity } from '../types';
import { focusUrl, meta, seesFleet } from './helpers';

/** Stations (work stations, and chargers / parking for supervisors and configurators) of the fleets the person sees. Operators get work stations only. */
export const stationEntity: SearchEntity<Station> = {
  type: 'station',
  label: () => copy.types.station,
  icon: MarkerPin01,
  permission: (ctx) =>
    ctx.can('supervisor.live-floor') || ctx.can('operator.book-trip') || ctx.can('configurator.maps'),
  load: (ctx) => {
    const work = !ctx.can('supervisor.live-floor') && !ctx.can('configurator.maps');
    return (mapNow()?.nav.stations ?? []).filter(
      (s) =>
        (!work || (s.type !== 'charge' && s.type !== 'park')) && s.fleets.some((f) => seesFleet(ctx.liveFleets, f)),
    );
  },
  fields: [
    { get: (s) => s.id, weight: 4 },
    { get: (s) => s.name, weight: 3 },
    { get: (s) => `${s.type} ${s.zone ?? ''}`, weight: 1 },
  ],
  id: (s) => s.id,
  home: ['supervisor', 'operator'],
  toResult: (s) => ({
    title: s.id,
    subtitle: s.name,
    url: focusUrl('station', s.id),
    facets: { fleet: s.fleets[0], zone: s.zone ?? undefined },
    metadata: [...meta(copy.meta.type, s.type), ...meta(copy.meta.area, s.zone)],
  }),
  actions: (s, ctx) =>
    ctx.can('supervisor.live-floor')
      ? [{ id: 'show', label: copy.actions.showOnMap, kind: 'navigate', url: focusUrl('station', s.id), primary: true }]
      : ctx.can('operator.book-trip')
        ? [{ id: 'book', label: copy.actions.book, kind: 'navigate', url: '/operator/book?tab=trips', primary: true }]
        : [{ id: 'maps', label: copy.actions.openMap, kind: 'navigate', url: '/configurator/maps', primary: true }],
};

/** The active areas of the floor. */
export const zoneEntity: SearchEntity<Zone> = {
  type: 'zone',
  label: () => copy.types.zone,
  icon: Grid01,
  permission: (ctx) => ctx.can('supervisor.live-floor'),
  load: () => (mapNow()?.site.zones ?? []).filter((z) => z.active),
  fields: [
    { get: (z) => z.name, weight: 4 },
    { get: (z) => z.kind, weight: 1 },
  ],
  id: (z) => z.id,
  home: ['supervisor'],
  toResult: (z) => ({
    title: z.name,
    subtitle: z.kind,
    url: focusUrl('zone', z.id),
    facets: { zone: z.name },
    metadata: meta(copy.meta.kind, z.kind),
  }),
  actions: (z) => [
    { id: 'show', label: copy.actions.showOnMap, kind: 'navigate', url: focusUrl('zone', z.id), primary: true },
  ],
};

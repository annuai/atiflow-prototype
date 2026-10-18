import type { Metadata } from '../types';

const LIVE_FLOOR = '/supervisor/livefloor';
export const focusUrl = (kind: 'robot' | 'station' | 'zone' | 'fleet', id: string) =>
  `${LIVE_FLOOR}?focus=${kind}:${encodeURIComponent(id)}`;
export const meta = (label: string, value: string | number | undefined | null, tone?: Metadata['tone']): Metadata[] =>
  value === undefined || value === null || value === '' ? [] : [{ label, value: String(value), tone }];
/** A fleet of the live map by its lane-map id, as a name. */
export const fleetNameOf = (fleets: { id: string; name: string }[], liveId: string) =>
  fleets.find((f) => f.id === liveId)?.name ?? liveId;
/** Does this person see this live fleet? */
export const seesFleet = (liveFleets: Set<string> | null, liveId: string) => !liveFleets || liveFleets.has(liveId);

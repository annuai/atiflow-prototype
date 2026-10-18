import type { FleetId } from '@/data/fleets';
/** URL of a fleet page (and one of its tabs). The fleet's id is the route key (a name still works in an old link: the page redirects to the id). */
export const fleetPath = (fleet: FleetId, tab = 'overview') =>
  `/configurator/fleets/${encodeURIComponent(fleet)}/${tab}`;
/** The page that lists every fleet. */
export const FLEETS_PATH = '/configurator/fleets';

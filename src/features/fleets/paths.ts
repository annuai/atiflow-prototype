/** URL of a fleet page (and one of its tabs). Fleet names are the route key. */
export const fleetPath = (fleet: string, tab = 'overview') =>
  `/configurator/fleets/${encodeURIComponent(fleet)}/${tab}`;
/** The page that lists every fleet. */
export const FLEETS_PATH = '/configurator/fleets';

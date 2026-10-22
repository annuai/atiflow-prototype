import type { NavGraph, SiteLayout } from '@/core/types';

/** The base floor of a blank workspace: nothing. Maps that are imported or generated bring their own building and lanes; there is no built-in demo floor underneath them. */
export function emptyBase(): { site: SiteLayout; nav: NavGraph } {
  return {
    site: {
      schema: 1,
      siteId: 'blank',
      name: '',
      units: 'm',
      bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
      floorPolygons: [],
      walls: [],
      pillars: [],
      zones: [],
      equipment: [],
      doors: [],
      labels: [],
    },
    nav: {
      schema: 2,
      siteId: 'blank',
      nodes: [],
      lanes: [],
      stations: [],
      fleets: [],
      trafficZones: [],
      forbiddenZones: [],
    },
  };
}

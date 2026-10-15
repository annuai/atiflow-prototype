import { MockSimulator } from '@/adapters/mock';
import type { FleetFeedService } from '../ports';

/** DUMMY live feed: the traffic simulator, driven in real time inside the page (14 robots at most, seed 7, rare faults switched on so reliability figures have something to show). */
export const createDummyFleetFeed = (): FleetFeedService => ({
  connect: ({ siteId, nav, roster }) => new MockSimulator(nav, siteId, 14, 7, roster),
});

import { liveAlertsSource } from './liveAlertsSource';
import { mesSource } from './mesSource';
import type { SourcesByAudience } from './types';

/** Which sources feed which workspace's audience: the page is the same for everyone, the notifications are not. Add a workspace here to give it its own. */
export const SOURCES: SourcesByAudience = {
  supervisor: () => [liveAlertsSource()],
  configurator: () => [mesSource()],
};

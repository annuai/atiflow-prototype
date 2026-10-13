import { liveAlertsSource } from './liveAlertsSource';
import { mesSource } from './mesSource';
import type { SourcesByRole } from './types';

/** Which sources feed which role: the page is the same for everyone, the notifications are not. Add a role here to give it its own. */
export const SOURCES: SourcesByRole = {
  supervisor: () => [liveAlertsSource()],
  configurator: () => [mesSource()],
};

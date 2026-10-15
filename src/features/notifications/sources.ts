import { liveAlertsSource } from './liveAlertsSource';
import { mesSource } from './mesSource';
import { requestUpdatesSource } from '@/features/requests/notifications';
import type { SourcesByAudience } from './types';

/** Which sources feed which workspace's audience: the page is the same for everyone, the notifications are not. Add a workspace here to give it its own. */
export const SOURCES: SourcesByAudience = {
  supervisor: () => [liveAlertsSource()],
  configurator: () => [mesSource()],
  operator: () => [requestUpdatesSource()], // trip status updates for their own requests, and requests waiting for their approval
};

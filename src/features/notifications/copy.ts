/** Every user-facing string of the notifications page. Titles and bodies of the notifications themselves come from their sources. */
export const copy = {
  title: 'Notifications',
  subtitle: {
    supervisor: 'Robots that need you, as they happen.',
    configurator: 'Updates from MES and your site setup.',
    operator: 'Updates on your requests, and requests waiting for you.',
  },
  all: 'All',
  unread: (n: number) => `Unread${n ? ` (${n})` : ''}`,
  markAll: 'Mark all as read',
  clear: 'Clear all',
  emptyAll: "You're all caught up",
  emptyAllHint: {
    supervisor: 'Blocked, stuck or low-battery robots will show up here.',
    configurator: 'New MES data and stock updates will show up here.',
    operator: 'Status updates of your requests will show up here.',
  },
  emptyUnread: 'No unread notifications',
  actions: { locate: 'Locate', liveFloor: 'Full view', requests: 'View request', approvals: 'Open approvals' },
  now: 'just now',
  ago: { min: (n: number) => `${n} min ago`, hour: (n: number) => `${n} h ago`, day: (n: number) => `${n} d ago` },
} as const;
export function timeAgo(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return copy.now;
  const m = Math.round(s / 60);
  if (m < 60) return copy.ago.min(Math.max(1, m));
  const h = Math.round(m / 60);
  return h < 24 ? copy.ago.hour(h) : copy.ago.day(Math.round(h / 24));
}

/** Every user-facing string of the notifications page. Titles and bodies of the notifications themselves come from their sources. */
export const notifications = {
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

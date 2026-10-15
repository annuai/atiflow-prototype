/** Every user-facing string of the supervisor's Settings (their own preferences). */
export const copy = {
  title: 'Settings',
  tabs: {
    alerts: {
      label: 'Alerts',
      subtitle: 'Your own preferences: which problems you hear about, and when. They apply only to you.',
    },
    start: { label: 'Start page', subtitle: 'Where the app opens for you.' },
  },
  alerts: {
    notify: 'Notify me about',
    notifyHint: 'These appear in the bell and on the Notifications page.',
    blocked: 'Blocked robots',
    fault: 'Robot faults',
    stuck: 'Robots stuck waiting',
    battery: 'Low battery',
    notifyAfter: 'Notify me when a robot has waited',
    notifyAfterHint: 'For the “stuck waiting” notification.',
    warn: 'Show a waiting robot on the Dashboard after',
    warnHint: 'It appears in “Needs attention”.',
    urgent: 'Mark it urgent after',
    batteryLow: 'A battery is low below',
    batteryLowHint: 'Used for the notification and the Dashboard.',
  },
  start: {
    page: 'Open the app on',
    pageHint: 'After you sign in, or when you open the app.',
    last: 'The page I used last',
    fleet: 'Live Floor opens with',
    fleetHint: 'When you open Live Floor from the sidebar. “All fleets” in the sidebar still shows everything.',
    allFleets: 'All fleets',
  },
  save: 'Save changes',
  cancel: 'Cancel',
  saved: 'Preferences saved',
  reset: 'Reset to defaults',
} as const;

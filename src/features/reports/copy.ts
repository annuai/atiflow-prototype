/** Every user-facing string of the Reports page. */
export const copy = {
  title: 'Reports', subtitle: 'How the fleet performed over a period. Arrows show whether higher or lower is better.',
  sample: 'Sample data: there is no history API yet, so periods other than a few minutes of today are generated from the robots on the floor. Today switches to measured values once the fleet has run for a few minutes.',
  origin: { live: (min: number) => `Live · ${min} min measured`, sample: 'Sample data' },
  trend: { title: 'Trend', hint: (daily: boolean) => (daily ? 'one point per day' : 'one point per hour'), collecting: 'Collecting data… the trend appears after a couple of points.' },
  range: { today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days', custom: 'Custom', label: 'Report period', refresh: 'Refresh', updated: (min: number) => (min < 1 ? 'Updated just now' : `Updated ${min} min ago`) },
  better: { higher: 'Higher is better', lower: 'Lower is better' },
  card: { vs: (what: string) => `vs ${what}`, same: 'No change' },
  changed: { title: 'What changed', hint: (vs: string) => `Biggest moves compared with ${vs}`, slipped: 'Slipped', improved: 'Improved', none: 'The period before has no data to compare with.', noneTitle: 'Nothing to compare yet' },
  all: { show: 'All KPIs', hide: 'Hide KPIs', note: 'Arrows show the better direction. Hover (i) for what each one means and how it is measured.' },
  error: 'The report could not be loaded', errorHint: 'Check your connection and try again.', retry: 'Try again', empty: 'No robots on the floor in this period.',
} as const;

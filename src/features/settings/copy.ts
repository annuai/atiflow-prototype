/** Every user-facing string of the Settings pages. */
export const copy = {
  title: 'Settings',
  tabs: { connections: { label: 'Connections', subtitle: 'The systems this app talks to, and whether they answer.' }, general: { label: 'General', subtitle: 'How this site is named, measured and shown.' } },
  card: {
    edit: 'Edit', test: 'Test connection', testing: 'Testing…', sync: 'Sync now', syncing: 'Syncing…', notSet: 'Not set', add: 'Add', lastSynced: 'Last synced', never: 'Never',
    lastTest: (ok: boolean, ago: string) => `${ok ? 'Reachable' : 'Failed'} · tested ${ago}`, notTested: 'Not tested yet',
  },
  edit: { title: (name: string) => `Edit ${name}`, subtitle: 'Changing an address clears the last test result. Use Test connection afterwards.', save: 'Save', saved: (name: string) => `${name} saved`, testOk: (name: string) => `${name} is reachable`, testFail: (name: string) => `${name} did not answer` },
  general: { siteName: 'Site name', siteNameHint: 'Shown wherever the app names the factory.', timeZone: 'Time zone', timeZoneHint: 'Used for reports and for what counts as “today”.', units: 'Units', metric: 'Metric (m, km)', imperial: 'Imperial (ft, mi)', language: 'Language', languageHint: 'More languages are not available yet.', save: 'Save changes', cancel: 'Cancel', saved: 'Settings saved', note: 'These are saved with the site. Units and language are not applied across the app yet.' },
} as const;

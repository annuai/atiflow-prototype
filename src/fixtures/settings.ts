import type { SettingsData } from '@/features/settings/model/types';

const HOUR = 3_600_000;
/** Starting values (example data, like the rest of the prototype). Fleet Manager is set up and was synced 18 hours ago; the MES addresses are not set yet. */
export const seedSettings = (now = Date.now()): SettingsData => ({
  version: 1,
  connections: {
    'fleet-manager': {
      values: { host: '192.168.100.31', clientId: 'app_user_example', clientSecret: 'example-secret-value' },
      lastSynced: now - 18 * HOUR,
      lastTest: { ok: true, message: 'Reachable', at: now - 18 * HOUR },
    },
    mes: { values: { amrUrl: '', bomUrl: '' } },
  },
  general: {
    siteName: 'ECC Plant',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    units: 'metric',
    language: 'English',
  },
});

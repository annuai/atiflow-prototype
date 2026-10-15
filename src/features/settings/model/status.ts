import { localized } from '@/i18n';
import { connectionErrors, missingFields } from './validate';
import type { ConnectionDef, ConnectionState, StatusView } from './types';

const misc = localized('misc').settings;
/** Why a connection is or is not fine, in words: missing fields first, then invalid ones, then the last test. Never tested but complete counts as connected. */
export function statusOf(def: ConnectionDef, s: ConnectionState): StatusView {
  const missing = missingFields(def, s.values);
  if (missing.length)
    return {
      status: 'issues',
      headline: misc.status.issues,
      detail: misc.status.notSet(missing.map((f) => f.label)),
    };
  const bad = Object.keys(connectionErrors(def, s.values));
  if (bad.length)
    return {
      status: 'issues',
      headline: misc.status.issues,
      detail: misc.status.notValid(bad.map((k) => def.fields.find((f) => f.key === k)!.label)),
    };
  if (s.lastTest && !s.lastTest.ok)
    return { status: 'issues', headline: misc.status.issues, detail: s.lastTest.message };
  return { status: 'connected', headline: misc.status.connected, detail: '' };
}

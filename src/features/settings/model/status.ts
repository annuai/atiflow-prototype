import { connectionErrors, missingFields } from './validate';
import type { ConnectionDef, ConnectionState, StatusView } from './types';

const list = (names: string[]) => (names.length <= 1 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
/** Why a connection is or is not fine, in words: missing fields first, then invalid ones, then the last test. Never tested but complete counts as connected. */
export function statusOf(def: ConnectionDef, s: ConnectionState): StatusView {
  const missing = missingFields(def, s.values);
  if (missing.length) return { status: 'issues', headline: 'Connection issues detected', detail: `${list(missing.map((f) => f.label))} ${missing.length > 1 ? 'are' : 'is'} not set.` };
  const bad = Object.keys(connectionErrors(def, s.values)); if (bad.length) return { status: 'issues', headline: 'Connection issues detected', detail: `${list(bad.map((k) => def.fields.find((f) => f.key === k)!.label))} ${bad.length > 1 ? 'are' : 'is'} not valid.` };
  if (s.lastTest && !s.lastTest.ok) return { status: 'issues', headline: 'Connection issues detected', detail: s.lastTest.message };
  return { status: 'connected', headline: 'Connected', detail: '' };
}

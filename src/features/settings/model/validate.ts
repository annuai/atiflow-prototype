import type { ConnectionDef, ConnectionField } from './types';
import { localized } from '@/i18n';

const misc = localized('misc').settings;

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}(:\d{1,5})?$/,
  HOSTNAME =
    /^(?=.{1,253}(:\d{1,5})?$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*(:\d{1,5})?$/i;

/** Problem with one value of a field ('' = fine; an empty optional value is fine). Hosts are an IPv4 address or a host name, optionally with a port; URLs are http(s). */
export function fieldError(f: ConnectionField, raw: string): string {
  const v = raw.trim();
  if (!v) return f.required ? localized('common').required : '';
  if (f.kind === 'text' || f.kind === 'secret') return ''; // only "required" applies
  if (f.kind === 'host')
    return IPV4.test(v) || (HOSTNAME.test(v) && !/^[\d.]+(:\d+)?$/.test(v)) ? '' : misc.validation.host;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:' ? '' : misc.validation.urlScheme;
  } catch {
    return misc.validation.urlFull;
  }
}
export function connectionErrors(def: ConnectionDef, values: Record<string, string>): Record<string, string> {
  const e: Record<string, string> = {};
  for (const f of def.fields) {
    const m = fieldError(f, values[f.key] ?? '');
    if (m) e[f.key] = m;
  }
  return e;
}
export const missingFields = (def: ConnectionDef, values: Record<string, string>) =>
  def.fields.filter((f) => f.required && !(values[f.key] ?? '').trim());

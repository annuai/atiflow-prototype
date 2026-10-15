import type { Device, DeviceKind, FieldValue } from './types';
import { t } from '../text';

export const nameOf = (d: Device) => String(d.values.name ?? '');
const text = (v: FieldValue | undefined) => (Array.isArray(v) ? v.join(',') : (v ?? '')).trim();
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Field-level errors for a new record: required fields filled, unique fields (name, hardware id) not already used. Empty object = valid. */
export function validateNew(
  kind: DeviceKind,
  values: Record<string, FieldValue>,
  existing: Device[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of kind.fields) {
    if (!f.modal) continue;
    const v = text(values[f.key]);
    if (f.required && !v) errors[f.key] = t.errors.required(f.label);
    else if (f.unique && v && existing.some((d) => same(text(d.values[f.key]), v)))
      errors[f.key] = t.errors.taken(f.label, v);
  }
  return errors;
}

/** Defaults for a record created from the modal: every field starts empty / first option, hidden fields use `initial`. */
export function blankValues(kind: DeviceKind, preset: Record<string, FieldValue> = {}): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {};
  for (const f of kind.fields)
    out[f.key] = f.control === 'checks' ? [] : f.control === 'select' ? (f.options?.[0] ?? '') : (f.initial ?? '');
  return { ...out, ...preset };
}

export const findDevice = (list: Device[], name: string) => list.find((d) => same(nameOf(d), name));

import type { NodeRoles, Slot } from '@/features/map-editor';
import type { PyObj, PyValue } from '../pyjson';
import { put, type Doc } from '../tree';

/** Plain JSON (the extras we kept) as the tree the Deployment Manager files are patched in. */
export function fromJson(v: unknown): PyValue {
  if (Array.isArray(v)) return v.map(fromJson);
  if (v && typeof v === 'object') return new Map(Object.entries(v).map(([k, x]) => [k, fromJson(x)]));
  return (v ?? null) as PyValue;
}
/** One slot as the file writes it: maneuver, direction and params (the fields we did not understand go back as they came). */
export function slotPy(slot: Slot): PyObj {
  const m = new Map<string, PyValue>();
  if (slot.maneuver) m.set('maneuver', slot.maneuver);
  if (slot.direction) m.set('maneuver_direction', slot.direction);
  const params = new Map<string, PyValue>(Object.entries(slot.params));
  const kept = (slot.extra?.params ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(kept)) params.set(k, fromJson(v));
  m.set('params', params);
  for (const [k, v] of Object.entries(slot.extra ?? {})) if (k !== 'params') m.set(k, fromJson(v));
  return m;
}
/** A role as a block of the file (`{pick, drop}` / `{laden, unladen}`), nothing when the role is off. */
export function rolePy(roles: NodeRoles, role: 'park' | 'unpark'): PyObj | undefined {
  const block = roles[role] as Record<string, Slot | undefined> | undefined;
  const entries = Object.entries(block ?? {}).flatMap(([id, s]) => (s ? [[id, slotPy(s)] as [string, PyValue]] : []));
  return entries.length ? new Map(entries) : undefined;
}
/** Set both roles on a node of a new entry. */
export function fillRoles(holder: PyObj, roles: NodeRoles) {
  for (const role of ['park', 'unpark'] as const) {
    const b = rolePy(roles, role);
    if (b) holder.set(role, b);
  }
}
/** Bring the roles of an existing node up to date: only a role that really differs is written; an off role is removed (an empty block already counts as off). */
export function writeRoles(doc: Doc, holder: PyObj, roles: NodeRoles): boolean {
  let wrote = false;
  for (const role of ['park', 'unpark'] as const) {
    const want = rolePy(roles, role);
    const have = holder.get(role);
    if (want) {
      const was = doc.dirty;
      doc.dirty = false;
      put(doc, holder, role, want);
      wrote ||= doc.dirty;
      doc.dirty ||= was;
    } else if (have instanceof Map && have.size) {
      holder.delete(role);
      doc.dirty = true;
      wrote = true;
    }
  }
  return wrote;
}

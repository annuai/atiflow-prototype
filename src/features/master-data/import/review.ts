import { sameCode } from '../model/logic';
import type { IncomingMaterial } from '../model/types';

export type RowStatus = 'available' | 'added' | 'duplicate' | 'invalid';
export interface ReviewRow extends IncomingMaterial {
  status: RowStatus;
}

/**
 * Classify parsed file rows against the current list:
 * added = code already in the list, duplicate = repeated earlier in the same file, invalid = name or code missing, available = can be imported.
 */
export function classifyRows(rows: IncomingMaterial[], existingCodes: string[]): ReviewRow[] {
  const seen: string[] = [];
  return rows.map((r) => {
    if (!r.code?.trim() || !r.name?.trim()) return { ...r, status: 'invalid' as const };
    if (existingCodes.some((c) => sameCode(c, r.code))) return { ...r, status: 'added' as const };
    if (seen.some((c) => sameCode(c, r.code))) return { ...r, status: 'duplicate' as const };
    seen.push(r.code);
    return { ...r, status: 'available' as const };
  });
}
export const selectable = (rows: ReviewRow[]) => rows.filter((r) => r.status === 'available');

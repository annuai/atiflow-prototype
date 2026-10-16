/**
 * Typed text that IS an identifier. Ids look like AMR-007, STA-113, TRP-014, DCP-1001, ORD-0001, ATI-1042; people also type R-07 or "amr 7": those become the canonical id.
 * Returns the canonical form, or null when the text is not shaped like an id.
 */
const SHAPE = /^([a-z]{2,4})[\s-]?0*(\d{1,6})$/i;
const PAD: Record<string, number> = { AMR: 3, STA: 3, TRP: 3, ORD: 4, BKG: 4, SA: 3, ATI: 4, CHARGE: 3, PARK: 3 };
export function canonicalId(text: string): string | null {
  const t = text.trim();
  const short = /^r[\s-]?0*(\d{1,3})$/i.exec(t); // "R-07"
  if (short) return `AMR-${short[1].padStart(3, '0')}`;
  const m = SHAPE.exec(t);
  if (!m) return null;
  const p = m[1].toUpperCase();
  return `${p}-${m[2].padStart(PAD[p] ?? 3, '0')}`;
}
export const sameId = (a: string, b: string) => a.toUpperCase() === b.toUpperCase();

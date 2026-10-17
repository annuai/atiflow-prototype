import { describe, expect, it } from 'vitest';
import { CATALOGS } from '@/i18n';

/** Every `columns.<key>` text of the English catalog is a table heading: Sentence case, always ("Robot name", not "Robot Name" or "ROBOT NAME"). */
function headings(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return /(^|\.)columns\.[a-z_]+$/i.test(path) ? [[path, node]] : [];
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node).flatMap(([k, v]) => headings(v, path ? `${path}.${k}` : k));
}
/** Words that keep their capitals (proper names). */
const NAMES = new Set(['Ati', 'ERP', 'API', 'ID']);

describe('table headings are in sentence case', () => {
  const found = headings(CATALOGS.en);
  it('finds the table headings', () => expect(found.length).toBeGreaterThan(20));
  for (const [path, text] of found)
    it(`${path}: "${text}"`, () => {
      const words = text.split(' ');
      expect(text === text.toUpperCase() && text.length > 3 && /[A-Z]/.test(text), 'not all capitals').toBe(false);
      for (const w of words.slice(1))
        expect(/^[A-Z][a-z]/.test(w) && !NAMES.has(w), `"${w}" should be lower case`).toBe(false);
    });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS } from '../src/features/access/catalog';

/** The authorization contract for the backend names every permission of the catalog, so adding a feature without saying who may use it fails here. */
describe('docs/architecture/authorization.md', () => {
  const doc = readFileSync('docs/architecture/authorization.md', 'utf8');
  it('mentions every permission of the access catalog', () => {
    const missing = ALL_PERMISSIONS.filter((id) => !doc.includes('`' + id + '`'));
    expect(missing).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { pageKey } from '../src/shell/pageKey';

describe('which URLs are the same page for the page transition', () => {
  it('tabs inside a page do not count as a new page', () => {
    expect(pageKey('/configurator/fleets/Line%20Side%20Fleet/materials')).toBe(
      pageKey('/configurator/fleets/Line%20Side%20Fleet/workflows'),
    );
    expect(pageKey('/configurator/fleets/A/overview')).not.toBe(pageKey('/configurator/fleets/B/overview'));
    expect(pageKey('/configurator/master-data/materials')).toBe(pageKey('/configurator/master-data/staging-area'));
    expect(pageKey('/configurator/settings/general')).toBe(pageKey('/configurator/settings/connections'));
    expect(pageKey('/supervisor/settings/alerts')).toBe(pageKey('/supervisor/settings'));
  });
  it('a list and its detail, or two pages, are different pages', () => {
    expect(pageKey('/configurator/robots')).not.toBe(pageKey('/configurator/robots/AMR-001'));
    expect(pageKey('/configurator/users/arjun')).not.toBe(pageKey('/configurator/users'));
    expect(pageKey('/supervisor/dashboard')).not.toBe(pageKey('/supervisor/reports'));
    expect(pageKey('/supervisor/dashboard/')).toBe(pageKey('/supervisor/dashboard'));
  });
});

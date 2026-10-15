import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '@/i18n';
import { pageTitle } from '@/shell/documentTitle';

afterEach(() => setLocale('en'));

describe('browser tab titles', () => {
  it('every page of the sidebar has its own title', () => {
    const paths: [string, string][] = [
      ['/configurator/robots', 'Robots · Ati Flow'],
      ['/configurator/hardware', 'Hardware · Ati Flow'],
      ['/configurator/maps', 'Maps · Ati Flow'],
      ['/configurator/maps/assembly-east', 'Maps · Ati Flow'],
      ['/configurator/master-data/materials', 'Master Data · Ati Flow'],
      ['/configurator/workflows/w-1', 'Workflows · Ati Flow'],
      ['/configurator/fleets', 'Fleets · Ati Flow'],
      ['/configurator/settings/general', 'Settings · Ati Flow'],
      ['/configurator/users', 'Users · Ati Flow'],
      ['/configurator/notifications', 'Notifications · Ati Flow'],
      ['/supervisor/dashboard', 'Dashboard · Ati Flow'],
      ['/supervisor/reports', 'Reports · Ati Flow'],
      ['/supervisor/livefloor', 'Live Floor · Ati Flow'],
      ['/supervisor/action-center', 'Action Center · Ati Flow'],
      ['/supervisor/settings/alerts', 'Settings · Ati Flow'],
      ['/operator/request', 'Request · Ati Flow'],
      ['/operator/approve', 'Approve · Ati Flow'],
      ['/operator/book', 'Book trip · Ati Flow'],
      ['/operator/history', 'History · Ati Flow'],
      ['/operator/settings/language', 'Settings · Ati Flow'],
      ['/login', 'Log in · Ati Flow'],
    ];
    for (const [path, title] of paths) expect(pageTitle(path), path).toBe(title);
  });
  it('a page that shows one named thing gives the name; it goes in front (data, never translated)', () => {
    expect(pageTitle('/configurator/robots/AMR-004', 'AMR-004')).toBe('AMR-004 · Robots · Ati Flow');
    expect(pageTitle('/configurator/fleets/x/materials', 'Line Side Fleet')).toBe(
      'Line Side Fleet · Fleets · Ati Flow',
    );
    expect(pageTitle('/configurator/maps/assembly-east', 'Assembly_Hall_East_All')).toBe(
      'Assembly_Hall_East_All · Maps · Ati Flow',
    );
    expect(pageTitle('/configurator/robots', null)).toBe('Robots · Ati Flow');
  });
  it('an unknown address gets the product name alone', () => {
    expect(pageTitle('/nowhere')).toBe('Ati Flow');
  });
  it('follows the language in use, keeping the product name', () => {
    setLocale('hi');
    expect(pageTitle('/configurator/robots/AMR-004', 'AMR-004')).toBe('AMR-004 · रोबोट · Ati Flow');
    setLocale('ta');
    expect(pageTitle('/supervisor/dashboard')).toContain('டாஷ்போர்டு');
  });
});

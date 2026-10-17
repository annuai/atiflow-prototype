import { describe, expect, it } from 'vitest';
import { CATALOGS, getLocale, localized, setLocale, showLocale } from '@/i18n';

describe('languages load on demand', () => {
  it('only English is loaded at first, and reads fall back to it', () => {
    expect(Object.keys(CATALOGS)).toEqual(['en']);
    setLocale('hi'); // not loaded yet: every text still reads (in English)
    expect(localized('common').cancel).toBe('Cancel');
    setLocale('en');
  });
  it('showLocale loads a language and then switches to it', async () => {
    await showLocale('hi');
    expect(getLocale()).toBe('hi');
    expect(CATALOGS.hi).toBeTruthy();
    expect(localized('common').cancel).not.toBe('Cancel');
    expect(CATALOGS.ta).toBeUndefined(); // the others were not touched
    await showLocale('en');
    expect(getLocale()).toBe('en');
  });
  it('when several languages are asked for quickly, the last one asked for wins', async () => {
    const a = showLocale('ml');
    const b = showLocale('ta');
    await Promise.all([a, b]);
    expect(getLocale()).toBe('ta');
    await showLocale('en');
  });
});

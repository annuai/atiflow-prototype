import { afterEach, describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, WORKSPACES } from '@/features/access';
import {
  CATALOGS,
  LANGUAGES,
  chooseLocale,
  loadAllCatalogs,
  localized,
  setLocale,
  toLocale,
  type LocaleId,
} from '@/i18n';

await loadAllCatalogs(); // the languages load on demand in the app; the tests compare all of them

/** Product names and acronyms that stay in Latin script in every language. */
const KEEP_LATIN = /^(Fleet Manager|MTBF|ASRS|KPI|SLA|MES|API|Ati Support|Ati AI)$/;
const SCRIPT: Record<LocaleId, RegExp | null> = {
  en: null,
  hi: /[ऀ-ॿ]/,
  kn: /[ಀ-೿]/,
  ml: /[ഀ-ൿ]/,
  ta: /[\u0B80-\u0BFF]/,
};
/** Every leaf of a catalog as `path -> text` (functions are called with sample arguments). */
function leaves(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return [[path, node]];
  if (typeof node === 'function') return leaves(call(node, [true, 'X', 2, 3]), path + '()');
  return Object.entries(node as object).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
}
const keysOf = (id: LocaleId) =>
  leaves(CATALOGS[id])
    .map(([k]) => k)
    .sort();

afterEach(() => setLocale('en'));

/** Calls a text function with sample arguments: plain text first, lists when it wants lists (e.g. fleet names). */
function call(fn: unknown, args: unknown[]): unknown {
  for (const a of [args, args.map((x) => [x, x])]) {
    try {
      return (fn as (...x: unknown[]) => unknown)(...a);
    } catch {
      /* try the next kind of argument */
    }
  }
  return '';
}

describe('translations', () => {
  for (const { id } of LANGUAGES.filter((l) => l.id !== 'en'))
    describe(id, () => {
      it('has exactly the keys of the English master', () => expect(keysOf(id)).toEqual(keysOf('en')));
      it('has no empty text and is written in its own script', () => {
        for (const [k, v] of leaves(CATALOGS[id])) {
          expect(v.trim(), k).not.toBe('');
          // plain code-like strings (urls, versions, "AMR-001") may stay Latin; everything with words must use the script
          if (
            /[A-Za-z]{4,}/.test(
              leaves(CATALOGS.en)
                .find(([p]) => p === k)![1]
                .replace(/true|X/g, ''),
            )
          )
            if (!/^[^\p{L}]*$|v\d|©|@/u.test(v) && !KEEP_LATIN.test(v)) expect(v, k).toMatch(SCRIPT[id]!);
        }
      });
      it('uses every argument its English text uses', () => {
        const calls = (c: unknown, path = ''): [string, string][] =>
          typeof c === 'function'
            ? [[path, JSON.stringify(call(c, ['S0', 'S1', 'S2']))]]
            : typeof c === 'object' && c
              ? Object.entries(c).flatMap(([k, v]) => calls(v, path ? `${path}.${k}` : k))
              : [];
        const mine = new Map(calls(CATALOGS[id]));
        for (const [k, en] of calls(CATALOGS.en))
          for (const arg of ['S0', 'S1', 'S2']) if (en.includes(arg)) expect(mine.get(k), `${k} ${arg}`).toContain(arg);
      });
    });
});

describe('the language in use', () => {
  it('localized() follows setLocale', () => {
    const t = localized('common');
    setLocale('hi');
    expect(t.cancel).toBe(CATALOGS.hi.common.cancel);
    setLocale('ml');
    expect(t.cancel).toBe(CATALOGS.ml.common.cancel);
    setLocale('en');
    expect(t.cancel).toBe('Cancel');
  });
  it('person beats device beats site beats browser', () => {
    expect(chooseLocale({ person: 'kn', device: 'hi', site: 'ml' })).toBe('kn');
    expect(chooseLocale({ device: 'hi', site: 'ml' })).toBe('hi');
    expect(chooseLocale({ site: 'ml' })).toBe('ml');
    expect(chooseLocale({ person: '', device: '' })).toBeTruthy();
  });
  it('reads language names and tags', () => {
    expect(toLocale('Hindi')).toBe('hi');
    expect(toLocale('ml-IN')).toBe('ml');
    expect(toLocale('हिन्दी')).toBe('hi');
    expect(toLocale('xx')).toBeNull();
  });
});

describe('names of workspaces and features', () => {
  it('every permission and workspace has a name in every language, and the catalog follows the language', () => {
    for (const { id } of LANGUAGES)
      for (const p of ALL_PERMISSIONS)
        expect((CATALOGS[id].nav.features as Record<string, string>)[p], `${id} ${p}`).toBeTruthy();
    setLocale('hi');
    expect(WORKSPACES[2].features[0].label).toBe(CATALOGS.hi.nav.features['operator.approve']);
    expect(WORKSPACES[0].name).toBe(CATALOGS.hi.nav.workspaces.configurator.name);
    setLocale('en');
    expect(WORKSPACES[2].features[0].label).toBe('Approve');
  });
});

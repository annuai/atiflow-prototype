import { CATALOGS, type Catalog } from './catalog';
import { getLocale } from './store';

const isNode = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function lookup(path: string[]): unknown {
  for (const id of [getLocale(), 'en'] as const) {
    let v: unknown = CATALOGS[id];
    for (const k of path) v = isNode(v) ? v[k] : undefined;
    if (v !== undefined) return v;
  }
  return undefined;
}

function node(path: string[]): unknown {
  return new Proxy(
    {},
    {
      get(_t, key) {
        if (typeof key === 'symbol') return undefined;
        const v = lookup([...path, key]);
        return isNode(v) ? node([...path, key]) : v;
      },
      has: (_t, key) => typeof key === 'string' && lookup([...path, key]) !== undefined,
      ownKeys: () => Object.keys((lookup(path) as object) ?? {}),
      getOwnPropertyDescriptor: (_t, key) =>
        typeof key === 'string' && lookup([...path, key]) !== undefined
          ? { enumerable: true, configurable: true }
          : undefined,
    },
  );
}

/**
 * The text of one area in the language in use: `const copy = localized('settings')`, then `copy.general.save` as always.
 * Every read looks up the current language, so a component that renders after a language change shows the new text
 * (the app root re-mounts on a change, see `LocaleBoundary`).
 */
export const localized = <K extends keyof Catalog>(area: K): Catalog[K] => node([area]) as Catalog[K];

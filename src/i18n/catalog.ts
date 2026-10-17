import * as en from './locales/en';
import { LANGUAGES, type LocaleId } from './languages';
import type { Messages } from './types';

/** English is the master: every other language is typed against it, so a missing or extra key is a compile error. */
export type Catalog = Messages<typeof en.catalog>;
/**
 * The catalogs that are loaded. English is always there (it is the fallback for every text); another language is fetched the first time it is
 * needed (`loadCatalog`), so a person who never leaves English never downloads, parses or holds the other four (about 1 MB of text).
 */
export const CATALOGS = { en: en.catalog } as unknown as Record<LocaleId, Catalog>; // typed as complete; a language that is not loaded yet is simply missing (reads fall back to English)
const LOADERS: Record<Exclude<LocaleId, 'en'>, () => Promise<{ catalog: Catalog }>> = {
  hi: () => import('./locales/hi'),
  kn: () => import('./locales/kn'),
  ml: () => import('./locales/ml'),
  ta: () => import('./locales/ta'),
};
export async function loadCatalog(id: LocaleId): Promise<void> {
  if (CATALOGS[id] || id === 'en') return;
  CATALOGS[id] = (await LOADERS[id]()).catalog;
}
/** Every language at once (the translation tests compare them). */
export const loadAllCatalogs = () => Promise.all(LANGUAGES.map((l) => loadCatalog(l.id))).then(() => undefined);

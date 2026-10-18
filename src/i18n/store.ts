import { useSyncExternalStore } from 'react';
import { loadCatalog } from './catalog';
import { DEFAULT_LOCALE, LANGUAGES, isLocale, toLocale, type LocaleId } from './languages';

/** The language in use. Resolution order is decided by the caller (`chooseLocale`); this is only the current value. */
let current: LocaleId = DEFAULT_LOCALE;
const listeners = new Set<() => void>();

export const getLocale = () => current;
export function setLocale(next: LocaleId) {
  if (!isLocale(next) || next === current) return;
  current = next;
  if (typeof document !== 'undefined') document.documentElement.lang = LANGUAGES.find((l) => l.id === next)!.htmlLang;
  listeners.forEach((l) => l());
}
let wanted: LocaleId = DEFAULT_LOCALE;
/** Switch to a language once its text is loaded (the latest request wins when several come quickly). Use this in the app; `setLocale` is for when the catalog is known to be loaded. */
export async function showLocale(next: LocaleId) {
  wanted = next;
  await loadCatalog(next);
  if (wanted === next) setLocale(next);
}
const subscribeLocale = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
export const useLocale = () => useSyncExternalStore(subscribeLocale, getLocale, getLocale);

/** The person's own choice wins, then the language chosen on this device (login page), then the site default, then the browser, then English. */
export function chooseLocale(opts: { person?: string | null; device?: string | null; site?: string | null }): LocaleId {
  const browser = typeof navigator === 'undefined' ? null : toLocale(navigator.language);
  return toLocale(opts.person) ?? toLocale(opts.device) ?? toLocale(opts.site) ?? browser ?? DEFAULT_LOCALE;
}

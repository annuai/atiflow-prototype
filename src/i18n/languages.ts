/**
 * THE list of interface languages. Adding one = an entry here + a folder in `locales/<id>/` with one file per area
 * (copy a finished language's folder) + one line in `catalog.ts`; the compiler then lists every missing text.
 * `font` is the Google Fonts family that carries the script (Blinker has Latin only); see index.html and ui/tokens.css.
 */
export const LANGUAGES = [
  { id: 'en', label: 'English', htmlLang: 'en', intl: 'en-GB' },
  { id: 'hi', label: 'हिन्दी', htmlLang: 'hi', intl: 'hi-IN' },
  { id: 'kn', label: 'ಕನ್ನಡ', htmlLang: 'kn', intl: 'kn-IN' },
  { id: 'ml', label: 'മലയാളം', htmlLang: 'ml', intl: 'ml-IN' },
  { id: 'ta', label: 'தமிழ்', htmlLang: 'ta', intl: 'ta-IN' },
] as const;
export type LocaleId = (typeof LANGUAGES)[number]['id'];
export const DEFAULT_LOCALE: LocaleId = 'en';
export const isLocale = (v: unknown): v is LocaleId => LANGUAGES.some((l) => l.id === v);
/** The language of a site setting or a browser language tag ("hi-IN", "Hindi", "हिन्दी"), or null. */
export function toLocale(v: string | null | undefined): LocaleId | null {
  if (!v) return null;
  const s = v.toLowerCase();
  const NAMES: Record<string, LocaleId> = { hindi: 'hi', kannada: 'kn', malayalam: 'ml', tamil: 'ta', english: 'en' };
  return (
    NAMES[s] ?? LANGUAGES.find((l) => s === l.id || s.startsWith(l.id + '-') || s === l.label.toLowerCase())?.id ?? null
  );
}

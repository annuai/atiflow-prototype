import * as en from './locales/en';
import * as hi from './locales/hi';
import * as kn from './locales/kn';
import * as ml from './locales/ml';
import * as ta from './locales/ta';
import type { LocaleId } from './languages';
import type { Messages } from './types';

/** English is the master: every other language is typed against it, so a missing or extra key is a compile error. */
export type Catalog = Messages<typeof en.catalog>;
export const CATALOGS: Record<LocaleId, Catalog> = {
  en: en.catalog,
  hi: hi.catalog,
  kn: kn.catalog,
  ml: ml.catalog,
  ta: ta.catalog,
};

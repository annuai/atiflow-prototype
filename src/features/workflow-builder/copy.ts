import { localized } from '@/i18n';

/** Every user-facing string of this feature lives in src/i18n/locales (one file per language). */
export const copy = localized('workflow');

/** Display label of a stored option value ("Tablet", "Pick Up"...). The stored value stays English; data (materials, stations, robots) comes back unchanged. */
export const optionLabel = (value: string): string => {
  const label = (copy.options as Record<string, unknown>)[value];
  return typeof label === 'string' ? label : value;
};

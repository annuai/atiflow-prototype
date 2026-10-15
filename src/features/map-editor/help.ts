import { helpTable } from './text';

export type HelpKey = keyof typeof helpTable;
/** The tooltip text of a key in the language in use (nothing when it has none: a missing line never breaks a form). */
export const helpText = (key: string): string | undefined => (helpTable as Record<string, string | undefined>)[key];
/** Spread onto a label-carrying component (`Input`, `Select`, `Label`, `NumberInput`): `<Input label="…" {...help('station.id')} />`. */
export const help = (key: HelpKey | string): { tooltip?: string } => {
  const t = helpText(key);
  return t ? { tooltip: t } : {};
};

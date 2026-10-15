import type { ConfigCategory, ConfigParam, ConfigSchema, ConfigValue, ConfigValues } from './types';

/** The parameters of a category grouped under their headings, in schema order (parameters without a group come first, under no heading). */
export function groupParams(category: ConfigCategory): { heading: string | null; params: ConfigParam[] }[] {
  const out: { heading: string | null; params: ConfigParam[] }[] = [];
  for (const p of category.params) {
    const heading = p.group ?? null;
    const g = out.find((x) => x.heading === heading);
    if (g) g.params.push(p);
    else out.push({ heading, params: [p] });
  }
  return out.sort((a, b) => Number(a.heading !== null) - Number(b.heading !== null));
}

/** The text of a refused value ('' = fine). `raw` is what the person typed for numbers. */
export function paramError(p: ConfigParam, raw: ConfigValue): string {
  if (p.kind === 'number') {
    const text = String(raw).trim();
    const n = Number(text);
    if (!text || !Number.isFinite(n)) return 'Enter a number.';
    if (p.integer && !Number.isInteger(n)) return 'Enter a whole number.';
    if (p.min !== undefined && n < p.min) return `Must be ${p.min}${p.unit ? ' ' + p.unit : ''} or more.`;
    if (p.max !== undefined && n > p.max) return `Must be ${p.max}${p.unit ? ' ' + p.unit : ''} or less.`;
  }
  if (p.kind === 'choice' && !p.options.includes(String(raw))) return 'Choose one of the options.';
  return '';
}

/** Every refused value of a draft, by parameter key (only parameters that exist in the schema are checked). */
export function configErrors(schema: ConfigSchema, draft: ConfigValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const c of schema.categories)
    for (const p of c.params) {
      const e = p.key in draft ? paramError(p, draft[p.key]) : '';
      if (e) errors[p.key] = e;
    }
  return errors;
}

/** Numbers typed as text become numbers; everything else is kept (call after `configErrors` is empty). */
export function normaliseDraft(schema: ConfigSchema, draft: ConfigValues): ConfigValues {
  const out: ConfigValues = { ...draft };
  for (const c of schema.categories)
    for (const p of c.params) if (p.kind === 'number' && p.key in out) out[p.key] = Number(out[p.key]);
  return out;
}

/** The keys whose draft value differs from the saved one (a number typed as text counts as equal to the same number). */
export function changedKeys(saved: ConfigValues, draft: ConfigValues): string[] {
  return Object.keys(draft).filter((k) => String(draft[k]) !== String(saved[k]));
}

/** How many parameters of a category are set to something other than the default (shown as a dot in the list). */
export function customised(category: ConfigCategory, values: ConfigValues, defaults: ConfigValues): number {
  return category.params.filter((p) => String(values[p.key]) !== String(defaults[p.key])).length;
}

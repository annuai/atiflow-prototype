import { localized } from '@/i18n';
import type { ConfigCategory, ConfigParam, UpdateRecord } from './model/types';

/** Inline text of the robot pages that is not in copy.ts (catalog: insights.robotOps). */
export const ins = localized('insights').robotOps;

type ParamText = { label: string; help?: string };
const PARAMS = (): Record<string, ParamText | undefined> => ins.params;
const OPTION_KEYS: Record<string, keyof typeof ins.options> = {
  Standard: 'standard',
  'High range': 'highRange',
  'Low power': 'lowPower',
};
const GROUP_KEYS: Record<string, keyof typeof ins.groups> = { 'Runaway Monitor': 'runawayMonitor' };

/**
 * The schema comes from the robot service and is cloned there, so its text is fixed in the language of the moment it was loaded. These look the display text up by id
 * when a screen draws, so a language change shows at once; an id the catalog does not know keeps the text the service sent.
 */
export const categoryLabel = (c: Pick<ConfigCategory, 'id' | 'label'>): string =>
  (ins.categories as Record<string, string | undefined>)[c.id] ?? c.label;
export const paramLabel = (p: Pick<ConfigParam, 'key' | 'label'>): string => PARAMS()[p.key]?.label ?? p.label;
export const paramHelp = (p: Pick<ConfigParam, 'key' | 'help'>): string | undefined => PARAMS()[p.key]?.help ?? p.help;
export const groupLabel = (g: string): string => (GROUP_KEYS[g] ? ins.groups[GROUP_KEYS[g]] : g);
export const optionLabel = (o: string): string => (OPTION_KEYS[o] ? ins.options[OPTION_KEYS[o]] : o);

/** The note of an update-history row: the starting entries and "Updated to vX." are translated, anything else a robot reported stays as it came. */
export function noteLabel(h: Pick<UpdateRecord, 'version' | 'notes'>): string {
  if (h.notes === `Updated to ${h.version}.`) return ins.notes.updatedTo(h.version);
  const known = (ins.notes as unknown as Record<string, unknown>)[h.version];
  const english = KNOWN_NOTES[h.version];
  return typeof known === 'string' && english === h.notes ? known : h.notes;
}
const KNOWN_NOTES: Record<string, string> = {
  'v3.2.1': 'Fixed lidar noise filtering anomalies and battery SOH logging precision.',
  'v3.1.0': 'Added dynamic speed limits inside tight safety zones.',
  'v3.0.2': 'Enhanced orchestrator mission scheduling latency.',
};

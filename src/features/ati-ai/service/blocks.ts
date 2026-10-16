import type { Block, Chip, PendingAction } from '../types';

export const text = (t: string): Block => ({ type: 'text', text: t });
export const chips = (c: Chip[]): Block => ({ type: 'chips', chips: c });
export const actions = (c: Chip[]): Block => ({ type: 'actions', actions: c });
let n = 0;
export const confirm = (title: string, lines: string[], action: PendingAction): Block => ({
  type: 'confirmation_card',
  id: `c${Date.now().toString(36)}${n++}`,
  title,
  lines,
  action,
});
export const chip = (id: string, label: string, payload?: Record<string, string>): Chip => ({ id, label, payload });
export const has = (t: string, re: RegExp) => re.test(t.toLowerCase());
/** The words of a sentence after a marker ("to line three" -> "line three"). */
export const after = (marker: RegExp) => marker;
export interface Reply {
  blocks: Block[];
  patch?: import('../types').Patch;
}

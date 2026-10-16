import { log } from '@/platform';

/** What search tells us so it can be improved: queries, searches with no result, which result was opened, which action was run. PLACEHOLDER: writes to the logger; connect an analytics tool here. */
export type SearchEvent =
  | { name: 'search'; q: string; total: number; tookMs: number; types?: string[] }
  | { name: 'zero_result'; q: string }
  | { name: 'result_click'; q: string; type: string; id: string; position: number }
  | { name: 'action_run'; type: string; id: string; action: string };
const l = log.child('search');
export const track = (e: SearchEvent) => l.info(e.name, e);

import { File06 } from '@untitledui/icons';
import { WORKSPACES, workspaceById } from '@/features/access';
import { copy } from '../copy';
import type { SearchEntity } from '../types';

interface PageRow {
  path: string;
  label: string;
  section: string;
  words: string;
}
/** Words people use for a page that its name does not say (data, not shown). */
const KEYWORDS: Record<string, string> = {
  'supervisor.live-floor': 'map 3d floor robots live camera',
  'supervisor.dashboard': 'overview kpi status home',
  'supervisor.reports': 'analytics kpi history utilisation throughput',
  'supervisor.action-center': 'calls help alerts problems queue',
  'supervisor.settings': 'preferences alerts language start page battery threshold notify',
  'configurator.robots': 'amr registry firmware calibration',
  'configurator.hardware': 'summon button hooter eye',
  'configurator.maps': 'map editor stations routes zones gates staging',
  'configurator.master-data': 'materials staging area stock parts',
  'configurator.workflows': 'workflow builder flow automation',
  'configurator.fleets': 'fleet robots assign',
  'configurator.settings': 'connections fleet manager mes language units time zone site',
  'operator.book-trip': 'request material order book trip robot send',
  'operator.history': 'past trips requests approvals',
  'operator.approve': 'approval requests waiting',
  'operator.action-center': 'calls help',
  'operator.settings': 'language preferences',
};
const rows = (): PageRow[] => {
  const out: PageRow[] = [];
  for (const w of WORKSPACES)
    for (const f of w.features) {
      const path = f.landing ?? f.routes[0];
      if (path) out.push({ path, label: f.label, section: w.name, words: KEYWORDS[f.id] ?? '' });
    }
  return out;
};
/** The pages of the app the person may open: the catalog's own list, filtered by `canOpen`. */
export const pageEntity: SearchEntity<PageRow> = {
  type: 'page',
  label: () => copy.types.page,
  icon: File06,
  permission: () => true,
  load: (ctx) => rows().filter((p) => ctx.canOpen(p.path)),
  fields: [
    { get: (p) => p.label, weight: 4 },
    { get: (p) => p.words, weight: 1 },
    { get: (p) => p.section, weight: 0.5 },
  ],
  id: (p) => p.path,
  home: [],
  toResult: (p) => ({
    title: p.label,
    subtitle: p.path,
    url: p.path,
    metadata: [{ label: copy.meta.section, value: p.section }],
  }),
  actions: (p) => [{ id: 'go', label: copy.actions.openPage, kind: 'navigate', url: p.path, primary: true }],
};
export { workspaceById };

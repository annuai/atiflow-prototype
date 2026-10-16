import { HelpCircle } from '@untitledui/icons';
import { KB, supportStore } from '@/features/support';
import { copy } from '../copy';
import type { SearchEntity } from '../types';
import { meta } from './helpers';

type Row =
  | { kind: 'ticket'; id: string; subject: string; status: string; at: number }
  | { kind: 'help'; id: string; title: string; steps: string };
/** The person's support tickets and the help articles. They open in the support window (`?support=` on the current page). */
export const supportEntity: SearchEntity<Row> = {
  type: 'ticket',
  label: () => copy.types.ticket,
  icon: HelpCircle,
  permission: () => true,
  load: () => [
    ...supportStore.getState().tickets.map((t) => ({
      kind: 'ticket' as const,
      id: t.id,
      subject: t.subject,
      status: t.status,
      at: t.updatedAt,
    })),
    ...Object.entries(KB).map(([k, a]) => ({
      kind: 'help' as const,
      id: `KB-${k}`,
      title: a.title,
      steps: a.steps.join(' '),
    })),
  ],
  fields: [
    { get: (x) => (x.kind === 'ticket' ? `${x.id} ${x.subject}` : x.title), weight: 3 },
    { get: (x) => (x.kind === 'ticket' ? x.status : x.steps), weight: 1 },
  ],
  id: (x) => x.id,
  home: [],
  toResult: (x) => {
    const url = `${typeof location === 'undefined' ? '' : location.pathname}?support=${encodeURIComponent(x.id)}`;
    return x.kind === 'ticket'
      ? {
          title: x.id,
          subtitle: x.subject,
          url,
          at: x.at,
          facets: { status: x.status },
          metadata: meta(copy.meta.status, x.status),
        }
      : { title: x.title, subtitle: x.steps.slice(0, 90), url, metadata: [] };
  },
  actions: (x) => [
    {
      id: 'open',
      label: copy.actions.openSupport,
      kind: 'navigate',
      url: `?support=${encodeURIComponent(x.id)}`,
      primary: true,
    },
  ],
};

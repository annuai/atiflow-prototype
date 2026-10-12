import { CheckCircle } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { cx } from '@/utils/cx';
import { fmtDuration } from '../data/derive';
import type { AttentionItem } from '../data/types';
import { copy } from '../copy';
import { Card, CardTitle } from './Cards';

/** Robots that need the supervisor, most urgent first. In TV mode the buttons are left out (nobody can click them). */
export function NeedsAttentionCard({ items, tv, limit, onLocate, onHelp }: { items: AttentionItem[]; tv?: boolean; limit?: number; onLocate?(robotId: string): void; onHelp?(item: AttentionItem): void }) {
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <Card tv={tv} className="flex h-full flex-col">
      <CardTitle title={copy.attention.title}>{items.length > 0 && <Badge size="sm" color={items.some((i) => i.level === 'critical') ? 'error' : 'warning'}>{items.length}</Badge>}</CardTitle>
      {!shown.length ? (
        <div className="grid flex-1 place-items-center py-8 text-center"><div><CheckCircle className="mx-auto mb-2 size-8 text-fg-success-primary" /><p className="font-medium text-primary">{copy.attention.empty}</p><p className="text-sm text-tertiary">{copy.attention.emptyHint}</p></div></div>
      ) : (
        <ul className="flex flex-col gap-2 overflow-y-auto">
          {shown.map((a) => (
            <li key={a.id} className={cx('flex items-center gap-3 rounded-lg border-l-4 bg-secondary px-3', tv ? 'py-3' : 'py-2.5', a.level === 'critical' ? 'border-l-error-solid' : 'border-l-warning-solid')}>
              <div className="min-w-0 flex-1">
                <p className={cx('truncate font-medium text-primary', tv ? 'text-lg' : 'text-sm')}><b>{a.robotId}</b> {a.title}</p>
                <p className={cx('truncate text-tertiary', tv ? 'text-base' : 'text-xs')}>{a.detail} · {a.fleetName}{a.seconds >= 60 && a.kind !== 'waiting' ? ` · ${fmtDuration(a.seconds)}` : ''}</p>
              </div>
              {!tv && <div className="flex shrink-0 gap-1.5"><Button size="sm" color="secondary" onPress={() => onLocate?.(a.robotId)}>{copy.attention.locate}</Button><Button size="sm" color="tertiary" onPress={() => onHelp?.(a)}>{copy.attention.help}</Button></div>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

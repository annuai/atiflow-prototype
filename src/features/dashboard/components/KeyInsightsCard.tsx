import { LinkExternal01 } from '@untitledui/icons';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { Select } from '@/components/base/select/select';
import type { Insight } from '../model';
import { Card, CardHeader } from './Card';

const DOT = { red: 'bg-error-solid', amber: 'bg-warning-solid', blue: 'bg-utility-blue-500' } as const;
const PERIODS = [{ id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }];

/** Key Insights: short findings about stock, routes and maintenance. */
export function KeyInsightsCard({ items, period, onPeriod, onOpen }: { items: Insight[]; period: 'today' | 'yesterday'; onPeriod(p: 'today' | 'yesterday'): void; onOpen(): void }) {
  return (
    <Card>
      <CardHeader title="Key Insights">
        <Select size="sm" aria-label="Period" className="w-32" selectedKey={period} onSelectionChange={(k) => onPeriod(k as 'today' | 'yesterday')} items={PERIODS}>{(item) => <Select.Item {...item} />}</Select>
        <ButtonUtility size="sm" color="secondary" icon={LinkExternal01} tooltip="Open all insights" aria-label="Open all insights" onPress={onOpen} />
      </CardHeader>
      <ul className="flex flex-col gap-3">
        {items.map((i) => (
          <li key={i.id} className="rounded-lg border border-secondary p-3">
            <p className="flex items-center gap-2 text-xs text-quaternary"><span className={`size-2 rounded-full ${DOT[i.tone]}`} />{i.ago}</p>
            <p className="mt-2 text-sm text-primary">{i.text}</p>
          </li>))}
      </ul>
    </Card>
  );
}

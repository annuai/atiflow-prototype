import { SegmentedTabs } from '@/components/data/SegmentedTabs';
import { t } from '../text';

export type InsightView = 'fleet' | 'materials';

/** "Fleet | Materials": the two separate views of the Dashboard and Reports (shown only to people whose fleets move material). */
export function ViewSwitch({ value, onChange }: { value: InsightView; onChange(v: InsightView): void }) {
  return (
    <SegmentedTabs
      label={t.tabs.label}
      value={value}
      onChange={onChange}
      items={[
        { id: 'fleet', label: t.tabs.fleet },
        { id: 'materials', label: t.tabs.materials },
      ]}
    />
  );
}

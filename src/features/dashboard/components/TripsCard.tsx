import { useState } from 'react';
import { CheckCircle, Truck01 } from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import { SegmentedTabs } from '@/components/data/SegmentedTabs';
import { ProgressBar } from '@/components/base/progress-indicators/progress-indicators';
import { cx } from '@/utils/cx';
import { fmtDuration } from '../data/derive';
import type { TripRow } from '../data/types';
import { copy } from '../copy';
import { Card, CardTitle } from './Cards';

type Tab = 'running' | 'recent';
function Row({ t, tv, onLocate }: { t: TripRow; tv?: boolean; onLocate?(robotId: string): void }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2"><span className={cx('font-semibold text-primary', tv ? 'text-lg' : 'text-sm')}>{t.id} <span className="font-normal text-tertiary">· {t.robotId}</span></span><span className={cx('text-tertiary', tv ? 'text-base' : 'text-xs')}>{t.done ? copy.trips.took(fmtDuration(t.seconds)) : fmtDuration(t.seconds)}</span></div>
      <p className={cx('truncate text-secondary', tv ? 'text-base' : 'text-xs')}>{t.origin ?? '…'} → {copy.trips.stops(t.stops.length)} → <b className="text-primary">{t.destination}</b> {t.destinationName && t.destinationName !== t.destination ? `· ${t.destinationName}` : ''}</p>
      {!t.done && <ProgressBar className="mt-1.5 h-1.5" value={Math.round(t.progress * 100)} />}
    </>
  );
  return onLocate ? <button type="button" className="w-full rounded-lg bg-secondary px-3 py-2 text-left hover:bg-secondary_hover" onClick={() => onLocate(t.robotId)}>{body}</button> : <div className="rounded-lg bg-secondary px-3 py-2">{body}</div>;
}

/** Trips (TRP-…) in progress and recently finished. Click one to open its robot on the Live Floor. */
export function TripsCard({ running, recent, tv, limit, onLocate }: { running: TripRow[]; recent: TripRow[]; tv?: boolean; limit?: number; onLocate?(robotId: string): void }) {
  const [tab, setTab] = useState<Tab>('running'); const list = (tv ? running : tab === 'running' ? running : recent).slice(0, limit ?? 50);
  return (
    <Card tv={tv} className="flex h-full min-h-0 flex-col">
      <CardTitle title={copy.trips.title}>{!tv && <SegmentedTabs<Tab> value={tab} onChange={setTab} label="Trips" items={[{ id: 'running', label: `${copy.trips.running} (${running.length})` }, { id: 'recent', label: copy.trips.recent }]} />}</CardTitle>
      {!list.length ? (tab === 'running' || tv ? <EmptyState icon={Truck01} title={copy.trips.empty} subtext={copy.trips.emptyHint} size="sm" /> : <EmptyState icon={CheckCircle} title={copy.trips.emptyRecent} subtext={copy.trips.emptyRecentHint} size="sm" />)
        : <ul className={cx('flex min-h-0 flex-col gap-2 overflow-y-auto', !tv && 'max-h-[24rem]')}>{list.map((t) => <li key={t.id + (t.done ? 'd' : '')}><Row t={t} tv={tv} onLocate={onLocate} /></li>)}</ul>}
    </Card>
  );
}

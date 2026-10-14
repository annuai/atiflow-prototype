import { AreaChart } from '../charts/AreaChart';
import type { HistoryPoint } from '../data/types';
import { copy } from '../copy';
import { Card, CardTitle } from './Cards';

/** Utilisation, running trips and waiting robots over time. The history starts when the page opens until a history API exists. */
export function ActivityCard({ history, seconds, robots, tv }: { history: HistoryPoint[]; seconds: number; robots: number; tv?: boolean }) {
  const times = history.map((p) => p.t);
  return (
    <Card tv={tv}>
      <CardTitle title={copy.throughput.title} hint={copy.throughput.since(Math.round(seconds / 60))} />
      <div className="grid gap-4 md:grid-cols-2">
        <div><p className="mb-1 text-xs font-medium text-secondary">{copy.throughput.utilisation} (%)</p><AreaChart label="Utilisation over time" times={times} yMax={100} unit="%" lines={[{ key: 'u', label: copy.throughput.utilisation, color: '#14b8a6', values: history.map((p) => p.utilisation), fill: true }]} /></div>
        <div><p className="mb-1 text-xs font-medium text-secondary">{copy.throughput.trips} and {copy.throughput.waiting.toLowerCase()}</p><AreaChart label="Trips and waiting robots over time" times={times} yMax={Math.max(4, robots)} lines={[{ key: 't', label: copy.throughput.trips, color: '#0ea5e9', values: history.map((p) => p.trips) }, { key: 'w', label: copy.throughput.waiting, color: '#8b5cf6', values: history.map((p) => p.waiting) }]} /></div>
      </div>
    </Card>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { store, useApp } from '@/core/store';
import { summarise } from '@/core/stats';
import { useAuth } from '@/features/auth/authStore';
import { feed, liveStats } from '@/features/live-floor/liveFeed';
import { LIVE_FLOOR_PATH, liveHits, useLiveNav } from '@/features/live-floor/liveNav';
import { useMasterData } from '@/features/master-data/model/store';
import { AppShell } from '@/shell/AppShell';
import { notify } from '@/ui/toast';
import { KeyInsightsCard } from './components/KeyInsightsCard';
import { LiveStatusCard } from './components/LiveStatusCard';
import { MetricCards } from './components/MetricCards';
import { PerformanceCard } from './components/PerformanceCard';
import { RobotAlertsCard } from './components/RobotAlertsCard';
import { firstName, greeting, insights, metricCards, performance, robotAlerts, utilisationBars, type Compare } from './model';

const soon = () => notify.info('Reports aren\'t part of this prototype', 'The Live Floor shows the same robots in real time.', 'soon');

/** Supervisor home: the fleet at a glance. Numbers come from the same live feed as the Live Floor. */
export function DashboardPage() {
  const navigate = useNavigate(); const user = useAuth((s) => s.user); const site = useApp((s) => s.site);
  const [robots, setRobots] = useState(() => Object.values(store.getState().robots));                // the feed ticks 10 times a second; the dashboard refreshes 2-3 times a second
  useEffect(() => { const t = window.setInterval(() => setRobots(Object.values(store.getState().robots)), 400); return () => window.clearInterval(t); }, []);
  const materials = useMasterData((s) => s.materials);
  const [compare, setCompare] = useState<Compare>('yesterday'); const [period, setPeriod] = useState<'today' | 'yesterday'>('today');
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const release = feed.acquire(); void feed.ready(); const t = window.setInterval(() => setNow(new Date()), 15_000); return () => { release(); window.clearInterval(t); }; }, []);
  const summary = useMemo(() => summarise(robots), [robots]);
  const util = summary.utilisation;
  const stats = performance(liveStats.utilisationAt(now.getHours()) ?? util, liveStats.tripsDone, liveStats.distanceM, liveStats.downtimeS, compare);
  const bars = utilisationBars(now.getHours(), (h) => liveStats.utilisationAt(h));
  const locate = (id: string) => navigate(LIVE_FLOOR_PATH, { state: { locate: id } });
  const openLive = () => navigate(LIVE_FLOOR_PATH);
  return (
    <AppShell useNavModel={useLiveNav} getHits={liveHits} searchPlaceholder="Search robots, stations, zones…">
      <div className="content">
        <div className="builder md-card"><div className="md-body flex flex-col gap-5 !px-5 !py-5 sm:!px-6">
          <header><p className="text-sm text-secondary">{greeting(now.getHours())}</p><h1 className="text-display-xs font-semibold text-primary sm:text-display-sm">{user ? firstName(user.name) : 'there'}</h1><p className="text-sm text-secondary">Here&apos;s what&apos;s happening today</p></header>
          <MetricCards cards={metricCards(summary, compare)} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <PerformanceCard now={now} bars={bars} stats={stats} compare={compare} onCompare={setCompare} onOpen={soon} />
            <KeyInsightsCard items={insights(robots, materials[0]?.code ?? null, now, period)} period={period} onPeriod={setPeriod} onOpen={soon} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <LiveStatusCard site={site} robots={robots} onLocate={locate} onOpen={openLive} />
            <RobotAlertsCard alerts={robotAlerts(robots, now.getTime())} now={now.getTime()} onLocate={locate} onOpen={openLive} />
          </div>
        </div></div>
      </div>
    </AppShell>
  );
}

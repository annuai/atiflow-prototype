import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Monitor01 } from '@untitledui/icons';
import { BadgeWithDot } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { useLoadPhase } from '@/components/skeleton/Skeleton';
import { useApp } from '@/core/store';
import { useAuth } from '@/features/auth';
import { LIVE_FLOOR_PATH } from '@/features/live-floor';
import { MaterialsLive, ViewSwitch, useMaterialsRelevant, type InsightView } from '@/features/material-insights';
import { notify } from '@/ui/toast';
import { ActivityCard } from './components/ActivityCard';
import { BatteryCard } from './components/BatteryCard';
import { FleetStatesCard } from './components/FleetStatesCard';
import { HotspotsCard } from './components/HotspotsCard';
import { DashboardSkeleton } from './components/DashboardSkeleton';
import { KpiRow } from './components/KpiRow';
import { LiveStatusCard } from './components/LiveStatusCard';
import { NeedsAttentionCard } from './components/NeedsAttentionCard';
import { StatusStrip } from './components/StatusStrip';
import { TripsCard } from './components/TripsCard';
import { copy } from './copy';
import { t } from './text';
import { firstName, greeting } from './data/greeting';
import { useDashboard } from './data/source';
import { TvScreen } from './tv/TvScreen';

/**
 * The supervisor dashboard: "do I need to do anything?" first (status strip, needs attention), then the fleets, the floor and the activity. Every number comes from `useDashboard()`;
 * to use real data, write another `DashboardSource` (data/source.ts).
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const site = useApp((s) => s.site);
  const snap = useDashboard();
  const phase = useLoadPhase(!snap);
  const [params, setParams] = useSearchParams();
  const tv = params.get('tv') === '1';
  const materialsRelevant = useMaterialsRelevant();
  const view: InsightView = materialsRelevant && params.get('view') === 'materials' ? 'materials' : 'fleet';
  const setView = (v: InsightView) => setParams(v === 'materials' ? { view: 'materials' } : {}, { replace: true });
  const setTv = useCallback(
    (on: boolean) => {
      setParams(on ? { tv: '1' } : {}, { replace: true });
      if (on) void document.documentElement.requestFullscreen?.().catch(() => {});
      else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); // real full screen when the browser allows it
    },
    [setParams],
  );
  const exitTv = useCallback(() => setTv(false), [setTv]);
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const t = window.setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const locate = (id: string) => navigate(LIVE_FLOOR_PATH, { state: { locate: id } });
  const help = () => notify.info(copy.attention.helpToast, copy.attention.helpBody, 'call-help'); // placeholder until a notification service exists
  return (
    <>
      <div className="content">
        <div className="title-block">
          <div>
            <h1>
              {greeting(hour)} {user ? firstName(user.name) : t.page.there}
            </h1>
            <p>{copy.subtitle}</p>
          </div>
          <div className="actions items-center">
            <BadgeWithDot size="md" color="success">
              {copy.live}
            </BadgeWithDot>
            <Button size="sm" color="secondary" iconLeading={Monitor01} onPress={() => setTv(true)}>
              {copy.tv}
            </Button>
          </div>
        </div>
        <div className="builder md-card">
          <div className="md-body flex flex-col gap-5 !px-5 !py-5 sm:!px-6">
            {materialsRelevant && (
              <div>
                <ViewSwitch value={view} onChange={setView} />
              </div>
            )}
            {view === 'materials' ? (
              <MaterialsLive />
            ) : !snap || phase !== 'ready' ? (
              phase === 'skeleton' ? (
                <DashboardSkeleton />
              ) : null
            ) : (
              <>
                <StatusStrip status={snap.status} />
                <KpiRow kpis={snap.kpis} />
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                  <NeedsAttentionCard items={snap.attention} onLocate={locate} onHelp={help} />
                  <FleetStatesCard fleets={snap.fleets} onSelect={() => navigate(LIVE_FLOOR_PATH)} />
                </div>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                  <LiveStatusCard
                    site={snap.site ?? site}
                    robots={snap.robots}
                    onLocate={locate}
                    onOpen={() => navigate(LIVE_FLOOR_PATH)}
                  />
                  <TripsCard running={snap.trips.running} recent={snap.trips.recent} onLocate={locate} />
                </div>
                <ActivityCard history={snap.history} seconds={snap.historySeconds} robots={snap.robots.length} />
                <div className="grid gap-4 lg:grid-cols-2">
                  <BatteryCard battery={snap.battery} onLocate={locate} />
                  <HotspotsCard hotspots={snap.hotspots} />
                </div>
                <p className="text-center text-xs text-tertiary">{copy.sample}</p>
              </>
            )}
          </div>
        </div>
      </div>
      {tv && snap && <TvScreen snap={snap} siteName={site?.name ?? t.page.floorFallback} onExit={exitTv} />}
    </>
  );
}

import { useQueryParam } from '@/hooks/use-query-param';
import { useEffect, useState } from 'react';
import { TabPanelMotion } from '@/components/motion/TabPanelMotion';
import { useNavigate } from 'react-router-dom';
import { Download01, LifeBuoy01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { EmptyState } from '@/components/data/EmptyState';
import { SegmentedTabs } from '@/components/data/SegmentedTabs';
import { StatusStrip, type StatusSummary } from '@/components/data/StatusStrip';
import { fleetDirectory } from '@/data/fleetDirectory';
import { useAccess } from '@/features/auth';
import { fmtDuration } from '@/features/dashboard';
import { LIVE_FLOOR_PATH } from '@/features/live-floor';
import { localized } from '@/i18n';
import { notify } from '@/ui/toast';
import { CallRow, ageS } from './components/CallRow';
import { ResolveDialog } from './components/ResolveDialog';
import { ResolvedLog } from './components/ResolvedLog';
import { copy } from './copy';
import { engine, useActionCenterRunning, useFeedReady } from './data/store';
import { ActionCenterSkeleton } from './components/ActionCenterSkeleton';
import { useLoadPhase } from '@/components/skeleton/Skeleton';
import { useCalls } from './data/useCalls';
import { logToCsv } from './model/engine';
import type { Call } from './model/types';
import { Page, PageCard, PageCardBody, PageHeader } from '@/components/page';

type Tab = 'open' | 'mine' | 'log';
const download = (name: string, text: string) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

/** Robots that call for help, for the person on the floor: take a call, go to the robot, fix it, resolve it. The same page for supervisors and operators (each in their own shell). */
export function ActionCenterPage() {
  const navigate = useNavigate();
  const { user, can } = useAccess();
  const me = user?.name ?? '';
  useActionCenterRunning();
  const { active, log, mine, open } = useCalls();
  const phase = useLoadPhase(!useFeedReady());
  const [tab, setTab] = useQueryParam<Tab>('tab', 'open', ['open', 'mine', 'log']);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolving, setResolving] = useState<Call | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const canLocate = can('supervisor.live-floor');
  const taken = active.length - open;
  const urgent = active.filter((c) => c.severity === 'critical').length;
  const oldest = Math.max(0, ...active.map((c) => ageS(c, now)));
  const status: StatusSummary = !active.length
    ? { level: 'ok', headline: copy.strip.ok, detail: copy.strip.okDetail }
    : {
        level: urgent ? 'critical' : 'warn',
        headline: urgent ? copy.strip.critical(urgent) : copy.strip.warn(active.length),
        detail: copy.strip.detail(open, taken, fmtDuration(oldest)),
      };
  const list = tab === 'mine' ? mine : active;
  const exportLog = () => {
    if (!log.length) {
      notify.info(copy.log.none, undefined, 'ac-export');
      return;
    }
    download(
      `action-center-${new Date().toISOString().slice(0, 10)}.csv`,
      logToCsv(log, (id) => fleetDirectory.byLiveId(id)?.name ?? id),
    );
    notify.success(copy.log.exported(log.length), undefined, 'ac-export');
  };
  const empty = tab === 'mine' ? [copy.empty.mine, copy.empty.mineHint] : [copy.empty.open, copy.empty.openHint];
  return (
    <>
      <Page>
        <PageHeader
          title={copy.title}
          subtitle={copy.subtitle}
          actions={
            <>
              {tab === 'log' && (
                <Button size="sm" color="secondary" iconLeading={Download01} onPress={exportLog}>
                  {copy.log.export}
                </Button>
              )}
            </>
          }
          actionsClassName="items-center"
        />
        <PageCard>
          <PageCardBody spacious>
            {phase !== 'ready' ? (
              phase === 'skeleton' ? (
                <ActionCenterSkeleton />
              ) : null
            ) : (
              <>
                <StatusStrip status={status} />
                <div>
                  <SegmentedTabs<Tab>
                    value={tab}
                    onChange={setTab}
                    label={localized('insights').actionCenter.ui.show}
                    items={[
                      { id: 'open', label: copy.tabs.open(active.length) },
                      { id: 'mine', label: copy.tabs.mine(mine.length) },
                      { id: 'log', label: copy.tabs.log },
                    ]}
                  />
                </div>
                <TabPanelMotion tabKey={tab} className="flex flex-col gap-4">
                  {tab === 'log' ? (
                    log.length ? (
                      <ResolvedLog rows={log} />
                    ) : (
                      <Empty title={copy.empty.log} hint={copy.empty.logHint} />
                    )
                  ) : !list.length ? (
                    <Empty title={empty[0]} hint={empty[1]} />
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {list.map((c) => (
                        <CallRow
                          key={c.id}
                          call={c}
                          now={now}
                          me={me}
                          expanded={expanded === c.id}
                          onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                          canLocate={canLocate}
                          onLocate={() => navigate(LIVE_FLOOR_PATH, { state: { locate: c.robots[0] } })}
                          onTake={() => {
                            engine.acknowledge(c.id, me);
                            notify.success(copy.taken, `${c.id} · ${c.title}`, 'ac-take');
                          }}
                          onRelease={() => {
                            engine.release(c.id);
                            notify.info(copy.released, undefined, 'ac-take');
                          }}
                          onResolve={() => setResolving(c)}
                        />
                      ))}
                    </ul>
                  )}
                </TabPanelMotion>
              </>
            )}
          </PageCardBody>
        </PageCard>
      </Page>
      <ResolveDialog
        call={resolving}
        onClose={() => setResolving(null)}
        onResolve={(r) => {
          if (resolving) {
            engine.resolve(resolving.id, me, r);
            notify.success(copy.resolve.done(resolving.id), r, 'ac-resolve');
          }
          setResolving(null);
        }}
      />
    </>
  );
}
const Empty = ({ title, hint }: { title: string; hint: string }) => (
  <EmptyState icon={LifeBuoy01} title={title} subtext={hint} size="lg" />
);

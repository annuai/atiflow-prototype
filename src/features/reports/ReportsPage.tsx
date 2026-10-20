import { useQueryParam } from '@/hooks/use-query-param';
import { useSearchParams } from 'react-router-dom';
import { rangeFromParams, rangeToParams } from './model/rangeUrl';
import { EmptyState } from '@/components/data/EmptyState';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, RefreshCcw01 } from '@untitledui/icons';
import { BadgeWithDot } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { StatusStrip } from '@/components/data/StatusStrip';
import { FleetFilter, useFleetFilter } from '@/features/fleet-filter';
import { feed } from '@/features/live-floor';
import { MaterialsReport, ViewSwitch, useMaterialsRelevant, type InsightView } from '@/features/material-insights';
import { AllKpis } from './components/AllKpis';
import { RangeBar } from './components/RangeBar';
import { Scorecard } from './components/Scorecard';
import { TrendPanel } from './components/TrendPanel';
import { WhatChanged } from './components/WhatChanged';
import { copy } from './copy';
import { useLoadPhase } from '@/components/skeleton/Skeleton';
import { ReportsSkeleton } from './components/ReportsSkeleton';
import { resolveRange } from './model/range';
import { reportSource } from './data/source';
import { useReport } from './data/useReport';
import { moves, summary } from './model/derive';
import { METRIC_ORDER } from './model/metrics';
import type { MetricId, RangeSelection } from './model/types';
import { Page, PageCard, PageCardBody, PageHeader } from '@/components/page';

/**
 * Supervisor Reports: how the fleet performed over a period, nothing about single robots (that is the Live Floor's job). The verdict first, the five KPIs that matter,
 * what changed and its trend; every other KPI is one click away. Numbers come from `reportSource` (measured for today, sample otherwise).
 */
export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const range = useMemo(() => rangeFromParams(params), [params]);
  const setRange = (r: RangeSelection) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        ['range', 'from', 'to'].forEach((k) => next.delete(k));
        Object.entries(rangeToParams(r)).forEach(([k, v]) => next.set(k, v));
        return next;
      },
      { replace: true },
    );
  const [trend, setTrend] = useQueryParam<MetricId>('trend', 'utilisation', METRIC_ORDER);
  const [view, setView] = useQueryParam<InsightView>('view', 'fleet', ['fleet', 'materials']);
  const [all, setAll] = useState(false);
  const materialsRelevant = useMaterialsRelevant();
  const period = useMemo(() => resolveRange(range), [range]);
  useEffect(() => feed.acquire(), []); // the fleet keeps running (and being measured) while this page is open
  const { scope, many } = useFleetFilter(); // all fleets combined, or just the chosen one
  const { report, loading, error, refresh } = useReport(reportSource, range, scope);
  const phase = useLoadPhase(!report && !error);
  const verdict = useMemo(() => (report ? summary(report) : null), [report]),
    changes = useMemo(() => (report ? moves(report) : []), [report]);
  const origin = report?.origin;
  return (
    <>
      <Page>
        <PageHeader
          title={copy.title}
          subtitle={copy.subtitle}
          actions={
            <>
              {origin && (
                <BadgeWithDot size="md" color={origin.kind === 'live' ? 'success' : 'warning'}>
                  {origin.kind === 'live' ? copy.origin.live(origin.observedMin) : copy.origin.sample}
                </BadgeWithDot>
              )}
              <Button size="sm" color="secondary" iconLeading={RefreshCcw01} isLoading={loading} onPress={refresh}>
                {copy.range.refresh}
              </Button>
            </>
          }
          actionsClassName="items-center"
        />
        <PageCard>
          <PageCardBody spacious className="gap-5">
            <RangeBar value={range} onChange={setRange} generatedAt={report?.generatedAt ?? null} />
            {(materialsRelevant || many) && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                {materialsRelevant ? <ViewSwitch value={view} onChange={setView} /> : <span />}
                <FleetFilter />
              </div>
            )}
            {materialsRelevant && view === 'materials' ? (
              <MaterialsReport period={period} />
            ) : error ? (
              <EmptyState
                icon={AlertCircle}
                size="lg"
                title={copy.error}
                subtext={copy.errorHint}
                action={
                  <Button size="sm" color="secondary" onPress={refresh}>
                    {copy.retry}
                  </Button>
                }
              />
            ) : !report || !verdict || phase !== 'ready' ? (
              phase === 'skeleton' ? (
                <ReportsSkeleton />
              ) : null
            ) : (
              <div className={loading ? 'flex flex-col gap-5 opacity-60 transition-opacity' : 'flex flex-col gap-5'}>
                <StatusStrip status={verdict} />
                <Scorecard report={report} selected={trend} onPick={setTrend} />
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                  <TrendPanel report={report} metric={trend} onMetric={setTrend} />
                  <WhatChanged moves={changes} vs={report.range.previousLabel} />
                </div>
                <div className="flex flex-col gap-3">
                  <div>
                    <Button
                      size="sm"
                      color="secondary"
                      iconTrailing={all ? ChevronUp : ChevronDown}
                      onPress={() => setAll(!all)}
                    >
                      {all ? copy.all.hide : copy.all.show}
                    </Button>
                  </div>
                  {all && <AllKpis report={report} />}
                </div>
              </div>
            )}
            {!(materialsRelevant && view === 'materials') && (
              <p className="text-center text-xs text-tertiary">{copy.sample}</p>
            )}
          </PageCardBody>
        </PageCard>
      </Page>
    </>
  );
}

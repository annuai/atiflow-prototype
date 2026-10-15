import { EmptyState } from '@/components/data/EmptyState';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, RefreshCcw01 } from '@untitledui/icons';
import { BadgeWithDot } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { StatusStrip } from '@/components/data/StatusStrip';
import { feed } from '@/features/live-floor';
import { AllKpis } from './components/AllKpis';
import { RangeBar } from './components/RangeBar';
import { Scorecard } from './components/Scorecard';
import { TrendPanel } from './components/TrendPanel';
import { WhatChanged } from './components/WhatChanged';
import { copy } from './copy';
import { useLoadPhase } from '@/components/skeleton/Skeleton';
import { ReportsSkeleton } from './components/ReportsSkeleton';
import { reportSource } from './data/source';
import { useReport } from './data/useReport';
import { moves, summary } from './model/derive';
import type { MetricId, RangeSelection } from './model/types';

/**
 * Supervisor Reports: how the fleet performed over a period, nothing about single robots (that is the Live Floor's job). The verdict first, the five KPIs that matter,
 * what changed and its trend; every other KPI is one click away. Numbers come from `reportSource` (measured for today, sample otherwise).
 */
export function ReportsPage() {
  const [range, setRange] = useState<RangeSelection>({ preset: 'today' }),
    [trend, setTrend] = useState<MetricId>('utilisation'),
    [all, setAll] = useState(false);
  useEffect(() => feed.acquire(), []); // the fleet keeps running (and being measured) while this page is open
  const { report, loading, error, refresh } = useReport(reportSource, range);
  const phase = useLoadPhase(!report && !error);
  const verdict = useMemo(() => (report ? summary(report) : null), [report]),
    changes = useMemo(() => (report ? moves(report) : []), [report]);
  const origin = report?.origin;
  return (
    <>
      <div className="content">
        <div className="title-block">
          <div>
            <h1>{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </div>
          <div className="actions items-center">
            {origin && (
              <BadgeWithDot size="md" color={origin.kind === 'live' ? 'success' : 'warning'}>
                {origin.kind === 'live' ? copy.origin.live(origin.observedMin) : copy.origin.sample}
              </BadgeWithDot>
            )}
            <Button size="sm" color="secondary" iconLeading={RefreshCcw01} isLoading={loading} onPress={refresh}>
              {copy.range.refresh}
            </Button>
          </div>
        </div>
        <div className="builder md-card">
          <div className="md-body flex flex-col gap-5 !px-5 !py-5 sm:!px-6">
            <RangeBar value={range} onChange={setRange} generatedAt={report?.generatedAt ?? null} />
            {error ? (
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
            <p className="text-center text-xs text-tertiary">{copy.sample}</p>
          </div>
        </div>
      </div>
    </>
  );
}

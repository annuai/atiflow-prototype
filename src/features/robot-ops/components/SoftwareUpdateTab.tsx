import { Download01, RefreshCw01, UploadCloud02 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { EmptyState } from '@/components/data/EmptyState';
import { useNow } from '@/hooks/use-now';
import { copy } from '../copy';
import { ins, noteLabel } from '../labels';
import { useSoftware } from '../data/useSoftware';
import { formatCheck, formatDate, updateAvailable } from '../model/software';
import type { RobotRef } from '../model/types';
import { RowSkeleton, TabHeader, TabState } from './TabParts';

/** The Software Update tab: the newest firmware on offer with Download to Robot (or Check for updates when the robot is current), and the history of updates. */
export function SoftwareUpdateTab({
  robot,
  online,
  onInstalled,
}: {
  robot: RobotRef;
  online: boolean;
  onInstalled?: (version: string) => void;
}) {
  const sw = useSoftware(robot, onInstalled);
  const s = sw.status;
  const now = useNow();
  const outOfDate = !!s && updateAvailable(s);
  return (
    <div className="flex flex-col gap-6">
      <TabHeader title={copy.software.title} subtitle={copy.software.subtitle} />
      <TabState
        loading={sw.loading && !s}
        error={sw.error}
        failTitle={copy.software.loadFailed}
        onRetry={sw.reload}
        skeleton={
          <div className="flex flex-col gap-3">
            <RowSkeleton />
            <RowSkeleton />
          </div>
        }
      />
      {s && (
        <>
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-secondary bg-primary p-4 shadow-xs sm:p-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary text-fg-secondary">
              <UploadCloud02 className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold text-primary">{copy.software.firmware(s.latest)}</p>
                <Badge size="sm" type="pill-color" color="success">
                  {copy.software.latest}
                </Badge>
              </div>
              <p className="text-sm text-tertiary">
                {copy.software.installed}: <span className="font-semibold text-secondary">{s.installed ?? '—'}</span> ·{' '}
                {copy.software.lastCheck}:{' '}
                <span className="font-semibold text-secondary">{formatCheck(s.lastCheckedAt, now)}</span> ·{' '}
                {copy.software.lastUpdated}: {s.lastUpdatedAt === null ? ins.time.never : formatDate(s.lastUpdatedAt)}
              </p>
              {!outOfDate && <p className="mt-1 text-xs text-quaternary">{copy.software.upToDate}</p>}
              {outOfDate && !online && <p className="mt-1 text-xs text-quaternary">{copy.software.offline}</p>}
            </div>
            {outOfDate ? (
              <Button
                size="md"
                color="primary"
                iconLeading={Download01}
                isLoading={sw.installing}
                isDisabled={!online && !sw.installing}
                onPress={sw.install}
              >
                {sw.installing ? copy.software.installing : copy.software.download}
              </Button>
            ) : (
              <Button size="md" color="secondary" iconLeading={RefreshCw01} isLoading={sw.checking} onPress={sw.check}>
                {sw.checking ? copy.software.checking : copy.software.check}
              </Button>
            )}
          </div>
          <section className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-primary">{copy.software.history}</h3>
            {s.history.length === 0 ? (
              <EmptyState
                size="sm"
                framed
                icon={UploadCloud02}
                title={copy.software.noHistory}
                subtext={copy.software.noHistoryBody}
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {s.history.map((h) => (
                  <li
                    key={`${h.version}-${h.at}`}
                    className="flex items-center justify-between gap-4 rounded-xl border border-secondary bg-primary px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-primary">
                        {h.version} <span className="font-normal text-tertiary">({formatDate(h.at)})</span>
                      </p>
                      <p className="text-sm text-secondary">{noteLabel(h)}</p>
                    </div>
                    <span className={h.result === 'success' ? 'text-sm text-tertiary' : 'text-sm text-error-primary'}>
                      {h.result === 'success' ? copy.software.success : copy.software.failedRow}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useNow } from '@/hooks/use-now';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { ClockRewind } from '@untitledui/icons';
import { ModalShell } from '@/components/modal/ModalShell';
import { ConfirmDialog } from '@/components/modal/ConfirmDialog';
import { lastUpdated } from '@/utils/timeAgo';
import { copy } from '../copy';
import type { MapHistory } from '../model/types';
import { draftOf, publishedOf } from '../model/store';

/** The version history, like Figma's: the draft (if there is one) and every published version. Open one, restore it into the draft, or discard the draft. */
export function VersionHistory({
  isOpen,
  onOpenChange,
  history,
  viewing,
  onView,
  onRestore,
  onDiscard,
}: {
  isOpen: boolean;
  onOpenChange(o: boolean): void;
  history: MapHistory | undefined;
  viewing: 'draft' | number;
  onView(v: 'draft' | number): void;
  onRestore(n: number): void;
  onDiscard(): void;
}) {
  const t = copy.historyPanel;
  const draft = draftOf(history);
  const published = publishedOf(history);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const now = useNow();
  const row = (key: string, active: boolean, head: React.ReactNode, sub: string, actions: React.ReactNode) => (
    <li
      key={key}
      className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${active ? 'border-brand bg-brand-primary' : 'border-secondary bg-primary'}`}
    >
      <div className="min-w-0 flex-1 basis-48">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-primary">{head}</p>
        <p className="text-sm text-tertiary">{sub}</p>
      </div>
      <div className="flex gap-2">{actions}</div>
    </li>
  );
  return (
    <>
      <ModalShell
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="lg"
        divided
        icon={ClockRewind}
        title={t.title}
        subtitle={t.subtitle}
        primary={{ label: 'Close', onPress: () => onOpenChange(false) }}
      >
        <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pt-4">
          {draft &&
            row(
              'draft',
              viewing === 'draft',
              <>
                {t.draft}
                <Badge size="sm" color="warning">
                  {copy.draft}
                </Badge>
              </>,
              `${t.basedOn(draft.basedOn)} · ${t.by(draft.createdBy, lastUpdated(draft.createdAt, now))}`,
              <>
                <Button
                  size="sm"
                  color="secondary"
                  isDisabled={viewing === 'draft'}
                  onPress={() => {
                    onView('draft');
                    onOpenChange(false);
                  }}
                >
                  {t.open}
                </Button>
                <Button size="sm" color="tertiary-destructive" onPress={() => setDiscarding(true)}>
                  {copy.discard}
                </Button>
              </>,
            )}
          {published.map((v, i) =>
            row(
              v.id,
              viewing === v.number,
              <>
                v{v.number}
                {i === 0 && (
                  <Badge size="sm" color="success">
                    {t.latest}
                  </Badge>
                )}
              </>,
              t.by(v.publishedBy ?? v.createdBy, lastUpdated(v.publishedAt ?? v.createdAt, now)),
              <>
                <Button
                  size="sm"
                  color="secondary"
                  isDisabled={viewing === v.number}
                  onPress={() => {
                    onView(v.number!);
                    onOpenChange(false);
                  }}
                >
                  {t.view}
                </Button>
                <Button
                  size="sm"
                  color="tertiary"
                  onPress={() => (draft ? setRestoring(v.number) : (onRestore(v.number!), onOpenChange(false)))}
                >
                  {t.restore}
                </Button>
              </>,
            ),
          )}
          {!draft && !published.length && <li className="py-6 text-center text-sm text-tertiary">{t.none}</li>}
        </ul>
      </ModalShell>
      <ConfirmDialog
        isOpen={restoring !== null}
        onOpenChange={(o) => !o && setRestoring(null)}
        title={t.restoreTitle(restoring ?? 0)}
        description={t.restoreBody}
        confirmLabel={t.restore}
        onConfirm={() => {
          if (restoring !== null) {
            onRestore(restoring);
            onOpenChange(false);
          }
        }}
      />
      <ConfirmDialog
        isOpen={discarding}
        onOpenChange={setDiscarding}
        title={t.discardTitle}
        description={t.discardBody}
        confirmLabel={copy.discard}
        onConfirm={() => {
          onDiscard();
          onOpenChange(false);
        }}
      />
    </>
  );
}

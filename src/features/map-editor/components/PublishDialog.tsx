import { AlertTriangle, CheckCircle, Rocket01, XCircle } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { ModalShell } from '@/components/modal/ModalShell';
import { copy } from '../copy';
import { text } from '../text';
import type { MapProblem } from '../model/validate';

/** Before Publish: the problems found. Blocking ones must be fixed (a published map may be at work); warnings are shown and may be ignored. */
export function PublishDialog({
  isOpen,
  onOpenChange,
  problems,
  nextNumber,
  onPublish,
  onShow,
}: {
  isOpen: boolean;
  onOpenChange(o: boolean): void;
  problems: MapProblem[];
  nextNumber: number;
  onPublish(): void;
  onShow(stationId: string): void;
}) {
  const t = copy.publishDialog;
  const blocks = problems.filter((p) => p.level === 'block'),
    warns = problems.filter((p) => p.level === 'warn');
  const list = (items: MapProblem[], Icon: typeof XCircle, tone: string) => (
    <ul className="flex flex-col gap-2">
      {items.map((p, i) => (
        <li key={i} className="flex items-start gap-3 rounded-xl border border-secondary p-3">
          <Icon className={`mt-0.5 size-5 shrink-0 ${tone}`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-primary">{p.title}</p>
            {p.detail && <p className="text-xs text-tertiary">{p.detail}</p>}
          </div>
          {p.stationId && (
            <Button
              size="sm"
              color="tertiary"
              onPress={() => {
                onShow(p.stationId!);
                onOpenChange(false);
              }}
            >
              {t.fix}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
  return (
    <ModalShell
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="lg"
      divided
      icon={Rocket01}
      title={blocks.length ? t.blocked : t.ready(nextNumber)}
      subtitle={blocks.length ? t.blockedHint : t.readyHint}
      secondary={{ label: text.common.cancel, onPress: () => onOpenChange(false) }}
      primary={{
        label: t.action,
        isDisabled: blocks.length > 0,
        onPress: () => {
          onPublish();
          onOpenChange(false);
        },
      }}
    >
      <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto pt-4">
        {blocks.length > 0 && list(blocks, XCircle, 'text-fg-error-primary')}
        {warns.length > 0 && (
          <>
            <p className="text-sm font-semibold text-secondary">{t.warnings}</p>
            {list(warns, AlertTriangle, 'text-fg-warning-primary')}
          </>
        )}
        {!problems.length && (
          <p className="flex items-center gap-2 text-sm text-secondary">
            <CheckCircle className="size-5 text-fg-success-primary" />
            {t.ok}
          </p>
        )}
      </div>
    </ModalShell>
  );
}

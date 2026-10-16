import { Trash01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { BottomSheet } from '@/components/modal/BottomSheet';

export interface CallRow {
  key: string;
  title: string;
  /** robot type and route, one line */
  detail: string;
  /** shows "Needs approval" */
  approval?: string;
}

/**
 * The confirmation before robots are called (the counterpart of the material cart): lists every trip about to be sent, lets the person take one out or clear the list, and sends them
 * all with one button. Used for several saved trips at once (each sends its own robot) and for a single custom trip (no removing: `onRemove` is left out).
 */
export function CallSheet({
  isOpen,
  onOpenChange,
  title,
  subtitle,
  rows,
  note,
  removeLabel,
  clearLabel,
  sendLabel,
  onRemove,
  onClear,
  onSend,
}: {
  isOpen: boolean;
  onOpenChange(o: boolean): void;
  title: string;
  subtitle: string;
  rows: CallRow[];
  /** e.g. "1 will wait for approval · 2 will start right away" */
  note?: string;
  removeLabel?: (title: string) => string;
  clearLabel: string;
  sendLabel: string;
  onRemove?: (key: string) => void;
  onClear(): void;
  onSend(): void;
}) {
  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={title}
      subtitle={subtitle}
      footer={
        <div className="flex flex-col gap-3">
          {note && <p className="text-sm text-tertiary">{note}</p>}
          <div className="flex gap-3">
            <Button size="xl" color="tertiary" onPress={onClear}>
              {clearLabel}
            </Button>
            <Button size="xl" color="primary" className="flex-1" isDisabled={!rows.length} onPress={onSend}>
              {sendLabel}
            </Button>
          </div>
        </div>
      }
    >
      <ul className="flex flex-col gap-3 pt-2">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-wrap items-center gap-3 rounded-2xl border border-secondary p-3">
            <div className="min-w-0 flex-1 basis-40">
              <p className="font-semibold text-primary">{r.title}</p>
              <p className="text-sm text-tertiary">{r.detail}</p>
              {r.approval && (
                <Badge size="sm" color="warning" className="mt-1">
                  {r.approval}
                </Badge>
              )}
            </div>
            {onRemove && removeLabel && (
              <ButtonUtility
                size="sm"
                className="!size-12"
                color="tertiary"
                icon={Trash01}
                tooltip={removeLabel(r.title)}
                aria-label={removeLabel(r.title)}
                onPress={() => onRemove(r.key)}
              />
            )}
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}

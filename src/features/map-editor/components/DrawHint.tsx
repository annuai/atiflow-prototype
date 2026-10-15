import { Button } from '@/components/base/buttons/button';
import { copy } from '../copy';

/** What the active drawing tool wants next, floating at the top centre of the map, with Finish (for roads and zones) and Cancel. */
export function DrawHint({
  text,
  canFinish,
  showFinish,
  onFinish,
  onCancel,
  cancelLabel,
}: {
  cancelLabel?: string;
  text: string;
  canFinish: boolean;
  showFinish: boolean;
  onFinish(): void;
  onCancel(): void;
}) {
  return (
    <div
      className="absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-primary px-4 py-2 text-sm text-secondary shadow-lg ring-1 ring-secondary"
      role="status"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="whitespace-nowrap">{text}</span>
      {showFinish && (
        <Button size="sm" color="primary" isDisabled={!canFinish} onPress={onFinish}>
          {copy.hint.finish}
        </Button>
      )}
      <Button size="sm" color="secondary" onPress={onCancel}>
        {cancelLabel ?? copy.hint.cancel}
      </Button>
    </div>
  );
}

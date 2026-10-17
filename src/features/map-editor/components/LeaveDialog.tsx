import { AlertCircle } from '@untitledui/icons';
import { ModalShell } from '@/components/modal/ModalShell';
import { copy } from '../copy';

/** Shown when someone tries to leave a map with unpublished edits: go back to editing, or throw the edits away and leave. */
export function LeaveDialog({ isOpen, onKeep, onDiscard }: { isOpen: boolean; onKeep(): void; onDiscard(): void }) {
  const t = copy.leave;
  return (
    <ModalShell
      isOpen={isOpen}
      onOpenChange={(o) => !o && onKeep()}
      icon={AlertCircle}
      title={t.title}
      subtitle={t.body}
      secondary={{ label: t.keep, onPress: onKeep }}
      primary={{ label: t.discard, destructive: true, onPress: onDiscard }}
    >
      <span />
    </ModalShell>
  );
}

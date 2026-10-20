import { AlertCircle } from '@untitledui/icons';
import { ModalShell } from '@/components/modal/ModalShell';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { localized } from '@/i18n';

/**
 * Put it in any page with a form: while `dirty`, leaving the page (a link, the sidebar, Back / Forward, closing the tab) asks first. "Discard changes" runs `onDiscard` (if the page keeps
 * its draft somewhere that outlives the page) and lets the navigation through; "Keep editing" stays. Draws nothing while nothing is pending.
 */
export function UnsavedGuard({
  dirty,
  paused = false,
  onDiscard,
  allow,
}: {
  dirty: boolean;
  /** True while the page is doing something that leaves on purpose (a delete that goes back to the list). */
  paused?: boolean;
  onDiscard?: () => void;
  /** Paths that are another view of the same work (the tabs of one form) and so are not "leaving". */
  allow?: (path: string) => boolean;
}) {
  const guard = useLeaveGuard(dirty && !paused, { allow });
  const t = localized('common').unsaved;
  return (
    <ModalShell
      isOpen={guard.pending}
      onOpenChange={(o) => !o && guard.stay()}
      icon={AlertCircle}
      title={t.title}
      subtitle={t.body}
      secondary={{ label: t.keep, onPress: guard.stay }}
      primary={{
        label: t.discard,
        destructive: true,
        onPress: () => {
          onDiscard?.();
          guard.leave();
        },
      }}
    >
      <span />
    </ModalShell>
  );
}

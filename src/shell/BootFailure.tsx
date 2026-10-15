import { AlertCircle } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { EmptyState } from '@/components/data/EmptyState';
import { copy } from './copy';

/**
 * Shown INSTEAD of the app when its data could not be loaded at start-up. Starting anyway would begin from empty data and the first save would overwrite what is really stored, so the
 * app waits for a successful load. Plain on purpose: it renders before any of the app's own modules exist.
 */
export function BootFailure({ failed, onRetry }: { failed: string[]; onRetry(): void }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-secondary p-6">
      <EmptyState
        framed
        icon={AlertCircle}
        title={copy.bootTitle}
        subtext={copy.bootText(failed.join(', '))}
        action={
          <Button size="md" color="primary" onPress={onRetry}>
            {copy.tryAgain}
          </Button>
        }
      />
    </div>
  );
}

import { AlertCircle, AlertTriangle, CheckCircle } from '@untitledui/icons';
import { cx } from '@/utils/cx';
import type { Level, StatusSummary } from '../data/types';

const LOOK: Record<Level, { box: string; icon: string; Icon: typeof CheckCircle }> = {
  ok: { box: 'bg-success-primary', icon: 'text-fg-success-primary', Icon: CheckCircle },
  warn: { box: 'bg-warning-primary', icon: 'text-fg-warning-primary', Icon: AlertTriangle },
  critical: { box: 'bg-error-primary', icon: 'text-fg-error-primary', Icon: AlertCircle },
};

/** The one-line answer to "do I need to do anything?". Same box as the other cards (border, shadow, padding); only the tint changes with the level. */
export function StatusStrip({ status, tv }: { status: StatusSummary; tv?: boolean }) {
  const { box, icon, Icon } = LOOK[status.level];
  return (
    <div role="status" aria-live="polite" className={cx('flex items-center gap-3 rounded-xl border border-secondary shadow-xs', box, tv ? 'p-4' : 'p-5')}>
      <Icon className={cx(icon, tv ? 'size-10' : 'size-6', 'shrink-0')} />
      <div className="min-w-0"><p className={cx('font-semibold text-primary', tv ? 'text-3xl' : 'text-md')}>{status.headline}</p><p className={cx('text-secondary', tv ? 'text-lg' : 'text-sm')}>{status.detail}</p></div>
    </div>
  );
}

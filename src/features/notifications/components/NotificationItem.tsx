import { AlertCircle, AlertTriangle, BatteryCharging01, CheckCircle, ClipboardCheck, Database01, InfoCircle, Package, Truck01 } from '@untitledui/icons';
import type { FC } from 'react';
import { Button } from '@/components/base/buttons/button';
import { cx } from '@/utils/cx';
import { copy, timeAgo } from '../copy';
import type { AppNotification, NotificationAction, NotificationLevel } from '../types';

const LEVEL: Record<NotificationLevel, { box: string; Icon: FC<{ className?: string }> }> = {
  critical: { box: 'bg-error-primary text-fg-error-primary', Icon: AlertCircle }, warn: { box: 'bg-warning-primary text-fg-warning-primary', Icon: AlertTriangle },
  info: { box: 'bg-brand-primary text-fg-brand-primary', Icon: InfoCircle }, success: { box: 'bg-success-primary text-fg-success-primary', Icon: CheckCircle },
};
const KIND_ICON: Partial<Record<AppNotification['kind'], FC<{ className?: string }>>> = { stock: Package, mes: Database01, battery: BatteryCharging01, trip: Truck01, approval: ClipboardCheck };

/** One notification: icon, title, text, time, a dot while unread and the buttons its source asked for (none = information only). */
export function NotificationItem({ n, now, onOpen, onAction }: { n: AppNotification; now: number; onOpen(): void; onAction(a: NotificationAction): void }) {
  const { box, Icon } = LEVEL[n.level]; const KindIcon = KIND_ICON[n.kind] ?? Icon;
  const label = (a: NotificationAction) => (a.kind === 'locate' ? copy.actions.locate : a.kind === 'requests' ? copy.actions.requests : a.kind === 'approvals' ? copy.actions.approvals : copy.actions.liveFloor);
  return (
    <li className={cx('flex items-start gap-3 rounded-xl border border-secondary p-4 shadow-xs', n.read ? 'bg-primary' : 'bg-secondary')} onClick={onOpen}>
      <span className={cx('mt-0.5 grid size-9 shrink-0 place-items-center rounded-full', box)}><KindIcon className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <p className={cx('text-sm text-primary', n.read ? 'font-medium' : 'font-semibold')}>{n.title}</p>
        {n.body && <p className="text-sm text-tertiary">{n.body}</p>}
        <p className="mt-1 text-xs text-quaternary">{timeAgo(n.at, now)}</p>
        {!!n.actions?.length && <div className="mt-3 flex flex-wrap gap-2">{n.actions.map((a, i) => <Button key={i} size="sm" color={i === 0 ? 'secondary' : 'tertiary'} onPress={() => onAction(a)}>{label(a)}</Button>)}</div>}
      </div>
      {!n.read && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-brand-solid" aria-label="Unread" />}
    </li>
  );
}

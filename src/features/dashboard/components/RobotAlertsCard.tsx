import { AlertCircle, CheckCircle, LinkExternal01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { cx } from '@/utils/cx';
import { timeAgo } from '@/utils/timeAgo';
import type { RobotAlert } from '../model';
import { Card, CardHeader } from './Card';

/** Robot Alerts: robots that are blocked, low on battery or breaking a rule. Investigate / View open the robot on the Live Floor. */
export function RobotAlertsCard({ alerts, now, onLocate, onOpen }: { alerts: RobotAlert[]; now: number; onLocate(robotId: string): void; onOpen(): void }) {
  return (
    <Card className="h-full">
      <CardHeader title="Robot Alerts"><ButtonUtility size="sm" color="secondary" icon={LinkExternal01} tooltip="Open Live Floor" aria-label="Open Live Floor" onPress={onOpen} /></CardHeader>
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-secondary px-4 py-10 text-center"><CheckCircle className="size-6 text-success-primary" aria-hidden /><p className="text-sm font-medium text-primary">All robots are running normally</p><p className="text-xs text-tertiary">Alerts appear here as soon as a robot needs a look.</p></div>
      ) : (
        <ul className="flex flex-col gap-4">
          {alerts.map((a) => (
            <li key={a.key} className={cx('flex items-center gap-3 rounded-xl p-3', a.critical ? 'bg-error-secondary' : 'bg-secondary')}>
              <AlertCircle className={cx('size-[18px] shrink-0', a.critical ? 'text-error-primary' : 'text-warning-primary')} aria-hidden />
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-primary">{a.robotId}</p><p className="text-xs text-tertiary">{a.text}</p></div>
              <div className="flex shrink-0 flex-col items-end gap-1.5"><span className="text-[11px] text-quaternary">{timeAgo(a.firstSeen, now, 'Just now')}</span>
                <Button size="sm" color={a.critical ? 'primary-destructive' : 'secondary'} onPress={() => onLocate(a.robotId)}>{a.critical ? 'Investigate' : 'View'}</Button></div>
            </li>))}
        </ul>)}
    </Card>
  );
}

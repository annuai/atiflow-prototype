import { useState } from 'react';
import { services } from '@/services';
import { notify } from '@/ui/toast';
import { useResource } from '@/hooks/use-resource';
import type { RobotRef, SoftwareStatus } from '../model/types';
import { copy } from '../copy';

/** The firmware state of one robot, checking for updates and installing the newest version. `onInstalled(version)` lets the caller keep other screens in step (the Details page). */
export function useSoftware(robot: RobotRef, onInstalled?: (version: string) => void) {
  const ops = services().robotOps;
  const status = useResource<SoftwareStatus>(() => ops.software.status(robot), robot.name);
  const [busy, setBusy] = useState<'check' | 'install' | null>(null);
  const run = async (what: 'check' | 'install') => {
    setBusy(what);
    try {
      const next = await (what === 'check' ? ops.software.checkForUpdates(robot) : ops.software.install(robot));
      status.set(next);
      if (what === 'install' && next.installed) {
        onInstalled?.(next.installed);
        notify.success(copy.software.installed_(next.installed), undefined, 'robot-software');
      }
    } catch (e) {
      notify.error(copy.software.installFailed, e instanceof Error ? e.message : undefined, 'robot-software');
    } finally {
      setBusy(null);
    }
  };
  return {
    status: status.data,
    loading: status.loading,
    error: status.error,
    reload: status.reload,
    checking: busy === 'check',
    installing: busy === 'install' || !!status.data?.installing,
    check: () => run('check'),
    install: () => run('install'),
  };
}

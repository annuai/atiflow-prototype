import { MotionConfig } from 'motion/react';
import { useOperatorNav } from '@/features/action-center/operatorNav';
import { useConfiguratorNav } from '@/features/configurator/configuratorNav';
import { useLiveNav } from '@/features/live-floor/liveNav';
import type { WorkspaceId } from '@/features/access';
import { AppShell } from './AppShell';
import { PageTransition } from './PageTransition';
import type { NavModel } from './types';
import { copy } from './copy';

const SHELLS: Partial<Record<WorkspaceId, { useNavModel: () => NavModel; placeholder: string }>> = {
  configurator: {
    useNavModel: useConfiguratorNav,
    get placeholder() {
      return copy.searchConfigurator;
    },
  },
  supervisor: {
    useNavModel: useLiveNav,
    get placeholder() {
      return copy.searchSupervisor;
    },
  },
  operator: {
    useNavModel: useOperatorNav,
    get placeholder() {
      return copy.searchOperator;
    },
  },
};

/**
 * The persistent frame of a workspace: sidebar and top bar are rendered ONCE here and stay while the pages inside change (so the sidebar can animate between
 * items and only the content area plays the page transition). A page is just its content; it never wraps itself in `AppShell`.
 */
/** (Keyed by workspace: the sidebar of each workspace uses its own hook, so a switch must remount it instead of re-rendering it with a different hook.) */
export function ShellLayout({ workspace }: { workspace: WorkspaceId }) {
  const s = SHELLS[workspace]!;
  return (
    <MotionConfig reducedMotion="user">
      <AppShell key={workspace} useNavModel={s.useNavModel} searchPlaceholder={s.placeholder}>
        <PageTransition />
      </AppShell>
    </MotionConfig>
  );
}

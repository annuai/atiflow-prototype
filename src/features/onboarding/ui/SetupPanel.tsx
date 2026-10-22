import { Check } from '@untitledui/icons';
import { Dialog } from 'react-aria-components';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { ProgressBar } from '@/components/base/progress-indicators/progress-indicators';
import { cx } from '@/utils/cx';
import { copy } from '../copy';
import { progressStore } from '../model/progress';
import type { SetupState, SetupStepId } from '../model/setup';

/** Where each step is done. */
export const STEP_PATH: Record<SetupStepId, string> = {
  robot: '/configurator/robots?add=1',
  map: '/configurator/maps?new=generate',
  hardware: '/configurator/hardware?add=1',
  fleet: '/configurator/fleets?new=1',
  materials: '/configurator/master-data/materials',
  workflow: '/configurator',
};

/** What the Setup Progress card opens: every step with where it stands, a button to go there, and what to do next highlighted. */
export function SetupPanel({ state, onGo }: { state: SetupState; onGo(path: string): void }) {
  return (
    <Dialog aria-label={copy.setup.panelTitle} className="w-[360px] max-w-[calc(100vw-32px)] p-5 outline-hidden">
      <h2 className="text-md font-semibold text-primary">{copy.setup.panelTitle}</h2>
      <p className="mt-0.5 text-sm text-tertiary">{copy.setup.panelHint}</p>
      <div className="mt-4 flex items-center gap-3">
        <ProgressBar className="h-2 flex-1" value={state.percent} />
        <span className="text-sm font-medium text-secondary tabular-nums">
          {copy.setup.count(state.done, state.total)}
        </span>
      </div>
      <ol className="mt-4 flex flex-col gap-1">
        {state.steps.map((s, i) => {
          const isNext = state.next === s.id;
          const t = copy.setup.steps[s.id];
          return (
            <li
              key={s.id}
              className={cx('flex items-start gap-3 rounded-lg p-2.5', isNext && 'bg-brand-primary ring-1 ring-brand')}
              aria-current={isNext ? 'step' : undefined}
            >
              <span
                className={cx(
                  'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  s.done
                    ? 'bg-fg-success-primary text-white'
                    : isNext
                      ? 'bg-brand-solid text-white'
                      : 'bg-secondary text-tertiary ring-1 ring-secondary',
                )}
                aria-hidden
              >
                {s.done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-primary">
                  {t.title}
                  {s.optional && !s.done && (
                    <Badge size="sm" color="gray">
                      {copy.setup.optional}
                    </Badge>
                  )}
                  {s.skipped && (
                    <Badge size="sm" color="gray">
                      {copy.setup.skipped}
                    </Badge>
                  )}
                </span>
                <span className="block text-xs text-tertiary">{t.hint}</span>
                {!s.done && (
                  <span className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" color={isNext ? 'primary' : 'secondary'} onPress={() => onGo(STEP_PATH[s.id])}>
                      {isNext ? t.next : copy.setup.go}
                    </Button>
                    {s.optional && (
                      <Button
                        size="sm"
                        color="tertiary"
                        onPress={() => progressStore.getState().set({ hardwareSkipped: true })}
                      >
                        {copy.setup.skip}
                      </Button>
                    )}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </Dialog>
  );
}

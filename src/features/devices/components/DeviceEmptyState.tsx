import { Plus } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { EmptyState } from '@/components/data/EmptyState';
import type { DeviceKind } from '../model/types';

/** First-use screen of Robots / Hardware: the shared empty state (icon, title, subtext), the hardware quick picks and the primary action. */
export function DeviceEmptyState({ kind, onAdd }: { kind: DeviceKind; onAdd(preset?: Record<string, string>): void }) {
  const e = kind.empty;
  return (
    <EmptyState icon={kind.icon} size="lg" className="m-auto max-w-xl" title={e.headline} subtext={<>{e.description}{e.hint && <span className="mt-1 block text-xs opacity-80">{e.hint}</span>}</>}
      action={<Button size="md" color="primary" iconLeading={Plus} onPress={() => onAdd()}>{kind.addLabel}</Button>}>
      {e.quickPicks && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <p className="text-sm font-semibold text-secondary">{e.prompt}</p>
          <div className="flex flex-wrap justify-center gap-4">
            {e.quickPicks.map((p) => (
              <button key={p.value} type="button" onClick={() => onAdd({ hwType: p.value })}
                className="flex size-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-primary bg-secondary text-secondary shadow-xs outline-focus-ring transition hover:bg-primary_hover focus-visible:outline-2">
                <p.icon className="size-10 stroke-1" /><span className="text-xs font-semibold text-primary">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </EmptyState>
  );
}

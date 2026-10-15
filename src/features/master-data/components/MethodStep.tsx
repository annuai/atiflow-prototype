import { Edit05, UploadCloud02, Database01 } from '@untitledui/icons';
import type { FC } from 'react';
import { Radio, RadioGroup } from 'react-aria-components';
import { cx } from '@/utils/cx';
import { copy } from '../copy';
import type { Method } from '../import/flow';

const OPTIONS: { id: Method; icon: FC<{ className?: string }> }[] = [
  { id: 'api', icon: Database01 },
  { id: 'file', icon: UploadCloud02 },
  { id: 'manual', icon: Edit05 },
];

/** "Add materials": pick one of the three ways in. Options are rendered from the flow's method list. */
export function MethodStep({ method, onChange }: { method: Method | null; onChange(m: Method): void }) {
  return (
    <RadioGroup
      aria-label={copy.method.title}
      value={method ?? ''}
      onChange={(v) => onChange(v as Method)}
      className="flex flex-col gap-3 pt-2"
    >
      {OPTIONS.map(({ id, icon: Icon }) => (
        <Radio
          key={id}
          value={id}
          className={({ isSelected, isFocusVisible }) =>
            cx(
              'flex cursor-pointer items-start gap-3 rounded-xl border bg-primary p-3 outline-focus-ring transition',
              isSelected ? 'border-brand ring-1 ring-brand' : 'border-secondary hover:bg-primary_hover',
              isFocusVisible && 'outline-2 outline-offset-2',
            )
          }
        >
          {({ isSelected }) => (
            <>
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-primary text-fg-secondary shadow-xs">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-secondary">{copy.method.options[id].title}</span>
                <span className="block text-sm text-tertiary">{copy.method.options[id].description}</span>
              </span>
              <span
                className={cx(
                  'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ring-1 ring-inset',
                  isSelected ? 'bg-brand-solid ring-brand-solid' : 'ring-primary',
                )}
              >
                {isSelected && <span className="size-1.5 rounded-full bg-white" />}
              </span>
            </>
          )}
        </Radio>
      ))}
    </RadioGroup>
  );
}

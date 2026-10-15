import { useSyncedState } from '@/hooks/use-synced-state';
import { Input } from '@/components/base/input/input';

/** A number box that edits as text and commits on blur / Enter (an unreadable value goes back to what it was). Used for positions, sizes, angles. */
export function NumberInput({
  label,
  value,
  onCommit,
  disabled,
  error,
  hint,
  integer,
  className,
  tooltip,
}: {
  tooltip?: string;
  label: string;
  value: number;
  onCommit(v: number): void;
  disabled?: boolean;
  error?: string;
  hint?: string;
  integer?: boolean;
  className?: string;
}) {
  const [text, setText] = useSyncedState(String(value));
  const commit = () => {
    const n = parseFloat(text);
    if (Number.isFinite(n) && (!integer || Number.isInteger(n))) {
      if (n !== value) onCommit(n);
    } else setText(String(value));
  };
  return (
    <Input
      label={label}
      tooltip={tooltip}
      size="sm"
      inputMode="decimal"
      value={text}
      isDisabled={disabled}
      isInvalid={!!error}
      hint={error ?? hint}
      wrapperClassName={className}
      onChange={setText}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

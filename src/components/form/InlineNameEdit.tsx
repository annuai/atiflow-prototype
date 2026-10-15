import { useState, type ReactNode } from 'react';
import { Edit05 } from '@untitledui/icons';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { Input } from '@/components/base/input/input';

interface Props {
  value: string;
  /** Save the new name. Return '' on success, or an error text to keep the box open and show it. */
  onSave(name: string): string;
  /** How the name is shown when not editing (e.g. a heading). */
  display: ReactNode;
  label: string;
  tooltip: string;
  className?: string;
}

/** A name with an edit (pencil) button: click to edit in place; Enter or clicking away saves, Esc cancels. Shared by fleet and workflow names. */
export function InlineNameEdit({ value, onSave, display, label, tooltip, className }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');
  const save = () => {
    const e = onSave(draft);
    if (e) {
      setError(e);
      return;
    }
    setError('');
    setEditing(false);
  };
  const cancel = () => {
    setDraft(value);
    setError('');
    setEditing(false);
  };
  if (editing) {
    return (
      <div className={className}>
        <Input
          size="sm"
          aria-label={label}
          className="w-[min(320px,60vw)]"
          value={draft}
          isInvalid={!!error}
          hint={error || undefined}
          onChange={(v) => {
            setDraft(v);
            setError('');
          }}
          autoFocus
          onFocus={(e) => e.target.select()}
          onBlur={() => {
            if (!error) save();
            else cancel();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') cancel();
          }}
        />
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`}>
      {display}
      <ButtonUtility
        size="xs"
        color="tertiary"
        icon={Edit05}
        tooltip={tooltip}
        aria-label={tooltip}
        onPress={() => {
          setDraft(value);
          setEditing(true);
        }}
      />
    </div>
  );
}

import { useState } from 'react';
import { AlertTriangle } from '@untitledui/icons';
import { Input } from '@/components/base/input/input';
import { ModalShell } from '@/components/modal/ModalShell';
import { localized } from '@/i18n';

interface Props {
  isOpen: boolean;
  onOpenChange(o: boolean): void;
  title: string;
  description: string;
  /** What the person has to type before the button works (a name that cannot be hit by accident). */
  phrase: string;
  /** The line above the box, for example `Type AMR-004 to confirm`. */
  prompt: string;
  confirmLabel: string;
  onConfirm(): void;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** A destructive confirmation that cannot be passed by clicking through: the confirm button stays disabled until `phrase` is typed. For actions that are hard to undo. */
export function TypeToConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  phrase,
  prompt,
  confirmLabel,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState('');
  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) setTyped('');
  };
  const ok = same(typed, phrase);
  const go = () => {
    if (!ok) return;
    onConfirm();
    close(false);
  };
  return (
    <ModalShell
      isOpen={isOpen}
      onOpenChange={close}
      icon={AlertTriangle}
      title={title}
      subtitle={description}
      secondary={{ label: localized('common').cancel, onPress: () => close(false) }}
      primary={{ label: confirmLabel, destructive: true, isDisabled: !ok, onPress: go }}
      onSubmit={go}
    >
      <Input autoFocus label={prompt} placeholder={phrase} value={typed} onChange={setTyped} />
    </ModalShell>
  );
}

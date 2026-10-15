import { useState } from 'react';
import { LifeBuoy01 } from '@untitledui/icons';
import { FormField } from '@/components/form/FormField';
import { ModalShell } from '@/components/modal/ModalShell';
import { localized } from '@/i18n';
import { copy } from '../copy';
import type { Call } from '../model/types';

function Form({ call, onClose, onResolve }: { call: Call; onClose(): void; onResolve(resolution: string): void }) {
  const [what, setWhat] = useState<string>(copy.resolve.options[0]);
  const [note, setNote] = useState('');
  return (
    <ModalShell
      isOpen
      onOpenChange={(o) => !o && onClose()}
      icon={LifeBuoy01}
      title={copy.resolve.title}
      subtitle={copy.resolve.subtitle(call.id, call.title)}
      divided
      secondary={{ label: localized('insights').actionCenter.ui.cancel, onPress: onClose }}
      primary={{ label: copy.resolve.action }}
      onSubmit={() => onResolve(note.trim() ? `${what}: ${note.trim()}` : what)}
    >
      <div className="flex flex-col gap-4 px-2 pt-4">
        <FormField
          def={{ key: 'what', label: copy.resolve.what, control: 'select', options: [...copy.resolve.options] }}
          value={what}
          onChange={(v) => setWhat(String(v))}
          fleets={[]}
        />
        <FormField
          def={{ key: 'note', label: copy.resolve.note, control: 'text', placeholder: copy.resolve.notePlaceholder }}
          value={note}
          onChange={(v) => setNote(String(v))}
          fleets={[]}
        />
      </div>
    </ModalShell>
  );
}
/** Mounted only while a call is being resolved, so every opening starts blank. */
export const ResolveDialog = ({
  call,
  onClose,
  onResolve,
}: {
  call: Call | null;
  onClose(): void;
  onResolve(resolution: string): void;
}) => (call ? <Form call={call} onClose={onClose} onResolve={onResolve} /> : null);

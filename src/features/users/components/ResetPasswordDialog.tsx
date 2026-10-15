import { useState } from 'react';
import { Key01 } from '@untitledui/icons';
import { FormField } from '@/components/form/FormField';
import { ModalShell } from '@/components/modal/ModalShell';
import { userDirectory } from '@/features/auth';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { passwordError } from '../model/validate';

function Form({
  username,
  name,
  isOpen,
  onOpenChange,
}: {
  username: string;
  name: string;
  isOpen: boolean;
  onOpenChange(o: boolean): void;
}) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    const e = passwordError(pw);
    setError(e);
    if (e) return;
    userDirectory.getState().resetPassword(username, pw);
    onOpenChange(false);
    notify.success(copy.reset.done, undefined, 'password-reset');
  };
  return (
    <ModalShell
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      icon={Key01}
      title={copy.reset.title}
      subtitle={copy.reset.subtitle(name)}
      secondary={{ label: 'Cancel', onPress: () => onOpenChange(false) }}
      primary={{ label: copy.reset.action }}
      onSubmit={submit}
    >
      <div className="pt-4">
        <FormField
          def={{
            key: 'password',
            label: copy.reset.label,
            control: 'secret',
            required: true,
            placeholder: 'At least 4 characters',
          }}
          value={pw}
          onChange={(v) => {
            setPw(String(v));
            setError('');
          }}
          error={error}
          fleets={[]}
        />
      </div>
    </ModalShell>
  );
}
/** Mounted only while open so every opening starts empty. */
export const ResetPasswordDialog = (props: {
  username: string;
  name: string;
  isOpen: boolean;
  onOpenChange(o: boolean): void;
}) => (props.isOpen ? <Form {...props} /> : null);

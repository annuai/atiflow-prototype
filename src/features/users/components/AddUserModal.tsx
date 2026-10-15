import { useState } from 'react';
import { Users01 } from '@untitledui/icons';
import { FormField } from '@/components/form/FormField';
import type { FieldDef } from '@/components/form/types';
import { ModalShell } from '@/components/modal/ModalShell';
import { assignableRoles, isFleetScoped, roleById, ROLES, type RoleId } from '@/features/access';
import { userDirectory, usernameTaken } from '@/features/auth/userDirectory';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { AvatarUpload } from './AvatarUpload';
import { FleetPicker } from './FleetPicker';
import { validateNew, type UserForm } from '../model/validate';

const roleByLabel = (label: string): RoleId => ROLES.find((r) => r.label === label)?.id ?? 'supervisor';
const field = (key: string, label: string, over: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label,
  control: 'text',
  ...over,
});

function Form({
  isOpen,
  onOpenChange,
  onAdded,
}: {
  isOpen: boolean;
  onOpenChange(o: boolean): void;
  onAdded?(username: string): void;
}) {
  const assignable = assignableRoles();
  const [avatar, setAvatar] = useState<string | undefined>();
  const [f, setF] = useState<UserForm>({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    role: 'supervisor',
    title: '',
    fleets: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: keyof UserForm) => (v: string | string[]) => {
    setF((o) => ({ ...o, [key]: key === 'role' ? roleByLabel(String(v)) : String(v) }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };
  const defs = {
    first: field('firstName', 'First Name', { required: true, placeholder: 'First name' }),
    last: field('lastName', 'Last Name', { placeholder: 'Last name' }),
    user: field('username', 'Username', { required: true, placeholder: 'Username' }),
    email: field('email', 'Email', { required: true, placeholder: 'name@company.com' }),
    pass: field('password', 'Password', { control: 'secret', required: true, placeholder: 'At least 4 characters' }),
    role: field('role', 'Role', {
      control: 'select',
      required: true,
      options: assignable.map((r) => roleById(r).label),
    }),
    title: field('title', 'Title', { placeholder: roleById(f.role).label }),
  };
  const submit = () => {
    const clean = {
      ...f,
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      username: f.username.trim(),
      email: f.email.trim(),
    };
    const problems = validateNew(clean, usernameTaken, assignable);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    const u = userDirectory
      .getState()
      .add({ ...clean, fleets: isFleetScoped(clean.role) ? clean.fleets : undefined, avatar });
    onOpenChange(false);
    onAdded?.(u.username);
    notify.success(copy.add_.toast(`${u.firstName} ${u.lastName}`.trim()), copy.add_.toastBody, 'user-added');
  };
  // a plain function (not a component defined here): a component type created on every render would remount the inputs and drop the focus on each key
  const F = (d: FieldDef, k: keyof UserForm, v: string) => (
    <FormField
      key={k}
      def={d}
      value={k === 'role' ? roleById(f.role).label : v}
      onChange={set(k)}
      error={errors[k]}
      fleets={[]}
    />
  );
  return (
    <ModalShell
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      icon={Users01}
      title={copy.add_.title}
      subtitle={copy.add_.subtitle}
      divided
      secondary={{ label: 'Cancel', onPress: () => onOpenChange(false) }}
      primary={{ label: copy.add }}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-5 px-2 pt-4">
        <AvatarUpload value={avatar} name={`${f.firstName} ${f.lastName}`.trim() || f.username} onChange={setAvatar} />
        <div className="grid grid-cols-2 gap-4">
          {F(defs.first, 'firstName', f.firstName)}
          {F(defs.last, 'lastName', f.lastName)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {F(defs.user, 'username', f.username)}
          {F(defs.email, 'email', f.email)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {F(defs.pass, 'password', f.password)}
          {F(defs.role, 'role', '')}
        </div>
        {F(defs.title, 'title', f.title)}
        {isFleetScoped(f.role) && (
          <FleetPicker
            value={f.fleets}
            onChange={(fleets) => {
              setF((o) => ({ ...o, fleets }));
              setErrors((e) => ({ ...e, fleets: '' }));
            }}
            error={errors.fleets}
          />
        )}
      </div>
    </ModalShell>
  );
}
/** Mounted only while open so every opening starts from a blank form. */
export const AddUserModal = (props: {
  isOpen: boolean;
  onOpenChange(o: boolean): void;
  onAdded?(username: string): void;
}) => (props.isOpen ? <Form {...props} /> : null);

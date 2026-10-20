import { UnsavedGuard } from '@/components/modal/UnsavedGuard';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Trash01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { Label } from '@/components/base/input/label';
import { FormField } from '@/components/form/FormField';
import { ConfirmDialog } from '@/components/modal/ConfirmDialog';
import {
  assignableRoles,
  canDeleteUser,
  isFleetScoped,
  isCustomised,
  roleById,
  ROLES,
  USERS_PATH,
  type AccessProfile,
  type RoleId,
} from '@/features/access';
import { useAuth, toPublic, userDirectory, useUsers } from '@/features/auth';
import { notify } from '@/ui/toast';
import '@/ui/detailPages.css';
import { PermissionMatrix } from './components/PermissionMatrix';
import { FleetPicker } from './components/FleetPicker';
import { ResetPasswordDialog } from './components/ResetPasswordDialog';
import { RoleBadge } from './components/RoleBadge';
import { AvatarUpload } from './components/AvatarUpload';
import { UserAvatar } from './components/UserAvatar';
import { copy } from './copy';
import { validateBasics } from './model/validate';
import { localized } from '@/i18n';
import { PageTitleName } from '@/shell/PageTitle';
import { Page, PageCard, PageHeader, PageSubtitle, PageTitle } from '@/components/page';
import { focusFirstError } from '@/utils/focus-first-error';

const misc = localized('misc');

const roleByLabel = (label: string): RoleId => ROLES.find((r) => r.label === label)?.id ?? 'supervisor';

/** One user: basic details (left) and the permission matrix (right). The role is a preset; "Overwrite permissions" ticks or unticks single features for this user only. */
export function UserDetailPage() {
  const { username = '' } = useParams();
  const navigate = useNavigate();
  const actor = useAuth((s) => s.user)!;
  const record = useUsers((s) => s.users.find((u) => u.username === username));
  const user = record ? toPublic(record) : null;
  const [draft, setDraft] = useState({
    firstName: '',
    lastName: '',
    email: '',
    title: '',
    role: 'supervisor' as RoleId,
    fleets: [] as string[],
    avatar: undefined as string | undefined,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false),
    [resetting, setResetting] = useState(false),
    [deleting, setDeleting] = useState(false);
  // another person opened: start their form from their stored details
  const [shownUser, setShownUser] = useState<string>();
  if (user && shownUser !== user.username) {
    setShownUser(user.username);
    setDraft({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      title: user.title,
      role: user.role,
      fleets: user.fleets ?? [],
      avatar: record?.avatar,
    });
    setErrors({});
    setEditing(false);
  }
  if (!user) return <Navigate to={USERS_PATH} replace />;
  const self = actor.username === user.username,
    canAccess = true,
    canBasics = true; // a configurator may change anyone's details, role and permissions, their own included
  const profile: AccessProfile = { role: user.role, custom: user.custom };
  const dirty =
    draft.firstName !== user.firstName ||
    draft.lastName !== user.lastName ||
    draft.email !== user.email ||
    draft.title !== user.title ||
    draft.role !== user.role ||
    draft.avatar !== record?.avatar ||
    JSON.stringify([...draft.fleets].sort()) !== JSON.stringify([...(user.fleets ?? [])].sort());
  const set = (k: keyof typeof draft) => (v: string | string[]) => {
    setDraft((d) => ({ ...d, [k]: k === 'role' ? roleByLabel(String(v)) : String(v) }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };
  const save = () => {
    const p = validateBasics(draft);
    setErrors(p);
    if (Object.keys(p).length) return focusFirstError();
    const roleChanged = draft.role !== user.role && canAccess;
    userDirectory.getState().update(user.username, {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      email: draft.email.trim(),
      title: draft.title.trim() || roleById(roleChanged ? draft.role : user.role).label,
      ...(roleChanged ? { role: draft.role, custom: undefined } : {}),
      fleets: isFleetScoped(draft.role) ? draft.fleets : undefined,
      avatar: draft.avatar,
    });
    notify.success(copy.detail.updated, undefined, 'user-updated');
  };
  const note = self ? copy.detail.selfNote : null;
  const roles = assignableRoles().map((r) => roleById(r).label);
  const roleField = { key: 'role', label: misc.userForm.roles, control: 'select' as const, options: roles };
  return (
    <>
      <UnsavedGuard dirty={dirty} paused={deleting} />
      <PageTitleName name={user.name} />
      <Page>
        <PageHeader
          heading={
            <div className="flex items-center gap-3">
              <UserAvatar user={user} size="lg" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <PageTitle>{user.name}</PageTitle>
                  <RoleBadge role={user.role} />
                  {isCustomised(profile) && (
                    <Badge size="md" type="pill-color" color="warning">
                      {copy.perms.customised}
                    </Badge>
                  )}
                </div>
                <PageSubtitle>{user.username}</PageSubtitle>
              </div>
            </div>
          }
          actions={
            <>
              <Button
                size="sm"
                color="primary-destructive"
                iconLeading={Trash01}
                isDisabled={!canDeleteUser(actor, user)}
                onPress={() => setDeleting(true)}
              >
                {copy.detail.delete}
              </Button>
            </>
          }
        />
        <PageCard>
          <div className="dv-scroll grid content-start gap-8 p-5 sm:p-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
            <section className="flex flex-col gap-4" aria-label={copy.detail.basic}>
              <h2 className="text-lg font-semibold text-primary">{copy.detail.basic}</h2>
              <AvatarUpload
                value={draft.avatar}
                preview={record ? toPublic({ ...record, avatar: undefined }).avatar : undefined}
                name={user.name}
                onChange={(avatar) => setDraft((d) => ({ ...d, avatar }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  def={{ key: 'firstName', label: misc.userForm.firstName, control: 'text', required: true }}
                  value={draft.firstName}
                  onChange={set('firstName')}
                  error={errors.firstName}
                  disabled={!canBasics}
                  fleets={[]}
                />
                <FormField
                  def={{ key: 'lastName', label: misc.userForm.lastName, control: 'text' }}
                  value={draft.lastName}
                  onChange={set('lastName')}
                  disabled={!canBasics}
                  fleets={[]}
                />
              </div>
              <FormField
                def={{ key: 'username', label: misc.userForm.username, control: 'text' }}
                value={user.username}
                onChange={() => {}}
                disabled
                fleets={[]}
              />
              <FormField
                def={{ key: 'email', label: misc.userForm.email, control: 'text', required: true }}
                value={draft.email}
                onChange={set('email')}
                error={errors.email}
                disabled={!canBasics}
                fleets={[]}
              />
              <FormField
                def={{
                  key: 'title',
                  label: misc.userForm.title,
                  control: 'text',
                  placeholder: roleById(user.role).label,
                }}
                value={draft.title}
                onChange={set('title')}
                disabled={!canBasics}
                fleets={[]}
              />
              <div className="flex flex-col gap-1.5">
                <Label>{misc.userForm.password}</Label>
                <div className="flex items-center gap-3">
                  <Input
                    aria-label={misc.userForm.password}
                    value={copy.detail.passwordMask}
                    isDisabled
                    wrapperClassName="flex-1"
                  />
                  <Button size="md" color="secondary" isDisabled={!canBasics} onPress={() => setResetting(true)}>
                    {copy.detail.resetPassword}
                  </Button>
                </div>
              </div>
              <div>
                <FormField
                  def={roleField}
                  value={roleById(draft.role).label}
                  onChange={set('role')}
                  disabled={!canAccess}
                  fleets={[]}
                />
                {canAccess && draft.role !== user.role && (
                  <p className="mt-1 text-xs text-tertiary">{copy.detail.roleNote}</p>
                )}
              </div>
              {isFleetScoped(draft.role) && (
                <FleetPicker
                  value={draft.fleets}
                  onChange={(fleets) => {
                    setDraft((d) => ({ ...d, fleets }));
                    setErrors((e) => ({ ...e, fleets: '' }));
                  }}
                  error={errors.fleets}
                />
              )}
              {note && <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-tertiary">{note}</p>}
              <div className="flex justify-end gap-3">
                <Button size="md" color="secondary" onPress={() => navigate(USERS_PATH)}>
                  {copy.detail.cancel}
                </Button>
                <Button size="md" color="primary" isDisabled={!dirty || !canBasics} onPress={save}>
                  {copy.detail.update}
                </Button>
              </div>
            </section>
            <section className="min-w-0 lg:border-l lg:border-secondary lg:pl-8" aria-label={copy.perms.title}>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 className="mr-1 text-lg font-semibold text-primary">{copy.perms.title}</h2>
                <div className="ml-auto flex items-center gap-2">
                  {editing && isCustomised(profile) && (
                    <Button
                      size="sm"
                      color="tertiary"
                      onPress={() => {
                        userDirectory.getState().update(user.username, { custom: undefined });
                        notify.success(copy.perms.saved, undefined, 'perms');
                      }}
                    >
                      {copy.perms.resetToRole}
                    </Button>
                  )}
                  <Button size="sm" color={editing ? 'primary' : 'secondary'} onPress={() => setEditing((e) => !e)}>
                    {editing ? copy.perms.done : copy.perms.overwrite}
                  </Button>
                </div>
              </div>
              <PermissionMatrix
                profile={profile}
                editable={editing && canAccess}
                onChange={(next) => userDirectory.getState().update(user.username, { custom: next.custom })}
              />
              {!editing && <p className="mt-4 text-xs text-quaternary">{copy.perms.locked}</p>}
            </section>
          </div>
        </PageCard>
      </Page>
      <ResetPasswordDialog username={user.username} name={user.name} isOpen={resetting} onOpenChange={setResetting} />
      <ConfirmDialog
        isOpen={deleting}
        onOpenChange={setDeleting}
        title={copy.detail.deleteTitle(user.name)}
        description={copy.detail.deleteBody}
        confirmLabel={copy.detail.delete}
        onConfirm={() => {
          userDirectory.getState().remove(user.username);
          notify.success(copy.detail.deleted(user.name), undefined, 'user-deleted');
          navigate(USERS_PATH, { replace: true });
        }}
      />
    </>
  );
}

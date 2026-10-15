import { fleetsError, roleById, type RoleId } from '@/features/access';
import { localized } from '@/i18n';

const misc = localized('misc');

/** The fields of the Add User dialog and the detail page, validated in one place (pure). */
export interface UserForm {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  role: RoleId;
  title: string;
  fleets: string[];
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
  USERNAME = /^[a-z0-9._-]{3,}$/i;
export const passwordError = (p: string) => (p.length >= 4 ? '' : misc.userValidation.passwordShort);
export const emailError = (e: string) =>
  !e.trim() ? localized('common').required : EMAIL.test(e.trim()) ? '' : misc.userValidation.emailInvalid;

/** Problems of a new user, by field key ('' / missing = fine). `taken` says whether a username already exists (ignoring case). */
export function validateNew(
  f: UserForm,
  taken: (username: string) => boolean,
  assignable: RoleId[],
): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.firstName.trim()) e.firstName = localized('common').required;
  if (!f.username.trim()) e.username = localized('common').required;
  else if (!USERNAME.test(f.username.trim())) e.username = misc.userValidation.usernameShape;
  else if (taken(f.username)) e.username = misc.userValidation.usernameTaken;
  const m = emailError(f.email);
  if (m) e.email = m;
  const p = passwordError(f.password);
  if (p) e.password = p;
  if (!assignable.includes(f.role)) e.role = misc.userValidation.roleNotAssignable(roleById(f.role).label);
  const fe = fleetsError(f.role, f.fleets);
  if (fe) e.fleets = fe;
  return e;
}
/** Problems when saving the basic details of an existing user. */
export function validateBasics(
  f: Pick<UserForm, 'firstName' | 'email'> & Partial<Pick<UserForm, 'role' | 'fleets'>>,
): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.firstName.trim()) e.firstName = localized('common').required;
  const m = emailError(f.email);
  if (m) e.email = m;
  const fe = f.role ? fleetsError(f.role, f.fleets ?? []) : '';
  if (fe) e.fleets = fe;
  return e;
}

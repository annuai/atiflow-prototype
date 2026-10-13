import { roleById, type RoleId } from '@/features/access';

/** The fields of the Add User dialog and the detail page, validated in one place (pure). */
export interface UserForm { firstName: string; lastName: string; username: string; email: string; password: string; role: RoleId; title: string }

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/, USERNAME = /^[a-z0-9._-]{3,}$/i;
export const passwordError = (p: string) => (p.length >= 4 ? '' : 'Use at least 4 characters');
export const emailError = (e: string) => (!e.trim() ? 'Required' : EMAIL.test(e.trim()) ? '' : 'Enter a valid email address');

/** Problems of a new user, by field key ('' / missing = fine). `taken` says whether a username already exists (ignoring case). */
export function validateNew(f: UserForm, taken: (username: string) => boolean, assignable: RoleId[]): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.firstName.trim()) e.firstName = 'Required';
  if (!f.username.trim()) e.username = 'Required'; else if (!USERNAME.test(f.username.trim())) e.username = 'At least 3 letters, numbers, dots, dashes or underscores'; else if (taken(f.username)) e.username = 'This username already exists';
  const m = emailError(f.email); if (m) e.email = m;
  const p = passwordError(f.password); if (p) e.password = p;
  if (!assignable.includes(f.role)) e.role = `${roleById(f.role).label} cannot be assigned by you`;
  return e;
}
/** Problems when saving the basic details of an existing user. */
export function validateBasics(f: Pick<UserForm, 'firstName' | 'email'>): Record<string, string> {
  const e: Record<string, string> = {}; if (!f.firstName.trim()) e.firstName = 'Required'; const m = emailError(f.email); if (m) e.email = m; return e;
}

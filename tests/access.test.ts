import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_PERMISSIONS, WORKSPACES, assignableRoles, canDeleteUser, canManageUsers, canOpen, can, effective, enterableWorkspaces, isCustomised, landingPath, presetOf, setPermission, setWorkspace, withRole, workspaceOfPath, workspacesOf } from '../src/features/access';
import { authStore } from '../src/features/auth/authStore';
import { findUser } from '../src/features/auth/authService';
import { migrate, toPublic, userDirectory, usernameTaken } from '../src/features/auth/userDirectory';
import { validateBasics, validateNew } from '../src/features/users/model/validate';

const kavin = { username: 'kavin', role: 'configurator' as const }, arjun = { username: 'arjun', role: 'supervisor' as const };
/** Meera: a configurator who also has every other module ticked (there is no separate superuser role). */
const meera = { username: 'meera', role: 'configurator' as const, custom: { add: ALL_PERMISSIONS.filter((p) => !p.startsWith('configurator.')), remove: [] } };

describe('the access catalog: what exists to be permitted', () => {
  it('has the four workspaces with the features of the brief, in order', () => {
    expect(WORKSPACES.map((w) => w.name)).toEqual(['Configurator', 'Supervisor', 'Line Supervisor', 'Operator']);
    expect(WORKSPACES[0].features.map((f) => f.label)).toEqual(['Robots', 'Maps', 'Hardware', 'Master Data', 'Workflows', 'Fleets']); expect(WORKSPACES[1].features.map((f) => f.label)).toEqual(['Dashboard', 'Reports', 'Live Floor']);
    expect(WORKSPACES[2].features).toEqual([]); expect(WORKSPACES[3].features.map((f) => f.label)).toEqual(['Dispatch', 'Request', 'Confirm']); expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });
  it('the dashboard permission covers dashboard-new too; unbuilt workspaces cannot be entered', () => {
    expect(canOpen(arjun, '/supervisor/dashboard')).toBe(true); expect(canOpen(arjun, '/supervisor/dashboard-new')).toBe(true); expect(enterableWorkspaces({ role: 'operator' })).toEqual([]);
    expect(workspaceOfPath('/supervisor/reports')).toBe('supervisor'); expect(workspaceOfPath('/configurator')).toBe('configurator'); expect(workspaceOfPath('/login')).toBeNull();
  });
});

describe('roles are presets; a user can be customised on top', () => {
  it('configurator = the six configurator features and nothing else; supervisor = the three; operator = the three; and Meera (a configurator with everything ticked) holds every permission', () => {
    expect([...effective(kavin)].sort()).toEqual(WORKSPACES[0].features.map((f) => f.id).sort()); expect([...effective(arjun)].sort()).toEqual(WORKSPACES[1].features.map((f) => f.id).sort());
    expect(presetOf('operator')).toHaveLength(3); expect(presetOf('line-supervisor')).toEqual([]); expect([...effective(meera)].sort()).toEqual([...ALL_PERMISSIONS].sort()); expect(isCustomised(meera)).toBe(true);
  });
  it('Kavin (configurator) opens configuration but not the supervisor pages; Arjun (supervisor) the opposite; both have notifications of their own workspace', () => {
    for (const p of ['/configurator', '/configurator/robots', '/configurator/maps', '/configurator/hardware/AMR-001', '/configurator/master-data/materials', '/configurator/workflows/abc', '/configurator/fleets/Line%20Side%20Fleet/overview', '/configurator/notifications']) expect(canOpen(kavin, p), p).toBe(true);
    for (const p of ['/supervisor/dashboard', '/supervisor/reports', '/supervisor/livefloor', '/supervisor/notifications']) expect(canOpen(kavin, p), p).toBe(false);
    for (const p of ['/supervisor/dashboard', '/supervisor/dashboard-new', '/supervisor/reports', '/supervisor/livefloor', '/supervisor/notifications']) expect(canOpen(arjun, p), p).toBe(true);
    for (const p of ['/configurator', '/configurator/robots', '/configurator/users', '/configurator/notifications']) expect(canOpen(arjun, p), p).toBe(false);
  });
  it('only configurators see the Users page', () => {
    expect(canOpen(kavin, '/configurator/users')).toBe(true); expect(canOpen(kavin, '/configurator/users/jane_doe')).toBe(true); expect(canOpen(meera, '/configurator/users')).toBe(true); expect(canOpen(arjun, '/configurator/users')).toBe(false);
    expect(canOpen({ role: 'operator' }, '/configurator/users')).toBe(false); expect(canManageUsers({ role: 'operator' })).toBe(false); expect(canManageUsers({ role: 'line-supervisor' })).toBe(false);
  });
  it('a tick stores only the difference from the preset, so unticking it again leaves no customisation; a role change starts over', () => {
    const p1 = setPermission(arjun, 'configurator.robots', true); expect(p1.custom).toEqual({ add: ['configurator.robots'], remove: [] }); expect(can(p1, 'configurator.robots')).toBe(true); expect(isCustomised(p1)).toBe(true);
    expect(canOpen(p1, '/configurator/robots')).toBe(true); expect(canOpen(p1, '/configurator/maps')).toBe(false);
    const p2 = setPermission(p1, 'configurator.robots', false); expect(isCustomised(p2)).toBe(false);
    const p3 = setPermission(kavin, 'configurator.maps', false); expect(p3.custom).toEqual({ add: [], remove: ['configurator.maps'] }); expect(canOpen(p3, '/configurator/maps')).toBe(false); expect(canOpen(p3, '/configurator/robots')).toBe(true);
    expect(withRole('operator')).toEqual({ role: 'operator' });
    const all = setWorkspace(arjun, 'configurator', true); expect(WORKSPACES[0].features.every((f) => can(all, f.id))).toBe(true); expect(isCustomised(setWorkspace(all, 'configurator', false))).toBe(false);
  });
  it('workspaces of a user: only those with a permission; Meera holds three, of which operator has no pages yet', () => {
    expect(workspacesOf(kavin).map((w) => w.id)).toEqual(['configurator']); expect(workspacesOf(meera).map((w) => w.id)).toEqual(['configurator', 'supervisor', 'operator']); expect(enterableWorkspaces(meera).map((w) => w.id)).toEqual(['configurator', 'supervisor']);
    expect(workspacesOf(setPermission(kavin, 'supervisor.reports', true)).map((w) => w.id)).toEqual(['configurator', 'supervisor']);
  });
});

describe('where a user lands', () => {
  it('the role\'s home, else the first page they may open, else the no-access page; a remembered page only if still allowed', () => {
    expect(landingPath(kavin)).toBe('/configurator'); expect(landingPath(arjun)).toBe('/supervisor/dashboard'); expect(landingPath(meera)).toBe('/configurator');
    expect(landingPath(arjun, '/supervisor/reports')).toBe('/supervisor/reports'); expect(landingPath(arjun, '/configurator/robots')).toBe('/supervisor/dashboard'); expect(landingPath(kavin, '/supervisor/livefloor')).toBe('/configurator');
    const onlyReports = { role: 'supervisor' as const, custom: { add: [], remove: ['supervisor.dashboard' as const, 'supervisor.live-floor' as const] } }; expect(landingPath(onlyReports)).toBe('/supervisor/reports');
    expect(landingPath({ role: 'operator' })).toBe('/no-access'); expect(landingPath({ role: 'line-supervisor' })).toBe('/no-access');
    const onlyFleets = { role: 'configurator' as const, custom: { add: [], remove: WORKSPACES[0].features.filter((f) => f.id !== 'configurator.fleets').map((f) => f.id) } }; expect(landingPath(onlyFleets)).toBe('/configurator/notifications');
  });
});

describe('who may change whom', () => {
  it('a configurator manages everyone, themselves included (they may even tick the other modules for themselves), but cannot delete themselves; non-managers manage no one', () => {
    expect(canDeleteUser(kavin, arjun)).toBe(true); expect(canDeleteUser(kavin, meera)).toBe(true); expect(canDeleteUser(kavin, kavin)).toBe(false); expect(canDeleteUser(arjun, kavin)).toBe(false);
    const self = setWorkspace(kavin, 'supervisor', true); expect(canOpen(self, '/supervisor/livefloor')).toBe(true); expect(canManageUsers(self)).toBe(true);        // "making themselves a superuser" is just ticking the other modules
  });
  it('every role can be handed out; there is no superuser role to assign', () => { expect(assignableRoles()).toEqual(['configurator', 'supervisor', 'line-supervisor', 'operator']); });
});

describe('the user directory and the session', () => {
  const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
  beforeEach(() => { vi.stubGlobal('localStorage', memory()); vi.stubGlobal('sessionStorage', memory()); userDirectory.getState().reset(); authStore.getState().logout(); });
  it('starts with Arjun (supervisor), Kavin (configurator) and Meera (configurator with all modules); add / update / reset password / remove work; usernames are unique ignoring case', () => {
    const d = userDirectory.getState(); expect(d.users.map((u) => `${u.username}:${u.role}`)).toEqual(['arjun:supervisor', 'kavin:configurator', 'meera:configurator']);
    const u = d.add({ username: 'Jane_Doe', password: 'abcd', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', role: 'operator' }); expect(u.username).toBe('jane_doe'); expect(u.title).toBe('Operator'); expect(usernameTaken('JANE_DOE')).toBe(true);
    expect(toPublic(u)).not.toHaveProperty('password'); expect(toPublic(u).name).toBe('Jane Doe'); expect(toPublic(u).avatar).toBeUndefined();
    d.update('jane_doe', { email: 'p@x.com', role: 'supervisor', custom: undefined }); expect(findUser('jane_doe')).toMatchObject({ email: 'p@x.com', role: 'supervisor' });
    d.resetPassword('jane_doe', 'newpass'); d.remove('jane_doe'); expect(findUser('jane_doe')).toBeNull(); expect(userDirectory.getState().users).toHaveLength(3);
  });
  it('the signed-in user follows the directory: a role or permission change applies at once, a deleted user is signed out', async () => {
    expect(await authStore.getState().login('arjun', '1234', false)).toBe('ok'); expect(canOpen(authStore.getState().user!, '/configurator/robots')).toBe(false);
    userDirectory.getState().update('arjun', { custom: setPermission(arjun, 'configurator.robots', true).custom }); expect(canOpen(authStore.getState().user!, '/configurator/robots')).toBe(true);
    userDirectory.getState().remove('arjun'); expect(authStore.getState().user).toBeNull();
  });
  it('validation: required names, a valid unique username, a valid email, a password of 4+, an assignable role', () => {
    const ok = { firstName: 'A', lastName: '', username: 'new_user', email: 'a@b.co', password: 'abcd', role: 'operator' as const, title: '' }; const roles = assignableRoles();
    expect(validateNew(ok, () => false, roles)).toEqual({}); expect(validateNew({ ...ok, username: 'kavin' }, usernameTaken, roles).username).toMatch(/already exists/); expect(validateNew({ ...ok, username: 'a b' }, () => false, roles).username).toBeTruthy();
    expect(validateNew({ ...ok, email: 'nope' }, () => false, roles).email).toBeTruthy(); expect(validateNew({ ...ok, password: '123' }, () => false, roles).password).toBeTruthy(); expect(validateNew({ ...ok, firstName: ' ' }, () => false, roles).firstName).toBe('Required');
    expect(validateNew({ ...ok, role: 'nonsense' as never }, () => false, roles).role).toBeTruthy(); expect(validateBasics({ firstName: '', email: 'x@y.zz' })).toEqual({ firstName: 'Required' });
  });
});

describe('profile pictures and old saved users', () => {
  it('only png / jpeg / webp images up to 5 MB are accepted', async () => {
    const { validAvatarFile } = await import('../src/features/users/model/image');
    expect(validAvatarFile({ type: 'image/png', size: 1000 })).toBe(true); expect(validAvatarFile({ type: 'image/jpeg', size: 5 * 1024 * 1024 })).toBe(true); expect(validAvatarFile({ type: 'image/gif', size: 10 })).toBe(false); expect(validAvatarFile({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })).toBe(false); expect(validAvatarFile({ type: 'application/pdf', size: 10 })).toBe(false);
  });
  it('a chosen picture is kept with the user and shown; a saved directory with the old superuser role becomes a configurator with every other module ticked', () => {
    const d = userDirectory.getState(); d.reset(); const u = d.add({ username: 'ann', password: 'abcd', firstName: 'Ann', lastName: '', email: 'ann@x.co', role: 'operator', avatar: 'data:image/jpeg;base64,AAAA' }); expect(toPublic(u).avatar).toBe('data:image/jpeg;base64,AAAA'); expect(toPublic(userDirectory.getState().users[0]).avatar).toBeTruthy();    // arjun keeps his own
    const old = migrate([{ username: 'x', password: 'p', firstName: 'X', lastName: '', email: 'x@y.zz', role: 'superuser' as never, title: 'T' }])[0]; expect(old.role).toBe('configurator'); expect(effective(old).size).toBe(ALL_PERMISSIONS.length);
  });
});

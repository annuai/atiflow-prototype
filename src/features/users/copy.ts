/** Every user-facing string of the Users pages. */
export const copy = {
  title: 'Users', subtitle: 'Manage users, their roles and access.',
  search: 'Search user by username, email, role, name…', add: 'Add User', none: (q: string) => `No users match “${q}”.`,
  columns: { name: 'Name', username: 'Username', email: 'Email', role: 'Role', actions: 'Actions' },
  add_: { title: 'Add User', subtitle: 'Give someone access. Their role decides what they can open; you can adjust it afterwards.', photo: 'Profile picture', upload: 'Upload photo', replace: 'Change photo', remove: 'Remove', photoHint: 'PNG, JPG or WebP, up to 5 MB. Optional.', photoBad: 'Choose an image file (PNG, JPG or WebP) up to 5 MB.', toast: (n: string) => `${n} added`, toastBody: 'They can sign in with the username and password you set.' },
  detail: {
    basic: 'Basic Details', cancel: 'Cancel', delete: 'Delete user', update: 'Update', updated: 'Details updated', resetPassword: 'Reset Password', passwordMask: '••••••••',
    deleteTitle: (n: string) => `Delete ${n}?`, deleteBody: 'They lose access immediately. This cannot be undone.', deleted: (n: string) => `${n} deleted`,
    selfNote: 'You cannot delete yourself.', roleNote: 'Changing the role starts from that role’s permissions again.',
  },
  fleets: { label: 'Assigned fleets', placeholder: 'Search fleets to add', hint: 'They only see these fleets (robots, trips, alerts and reports). Configurators always see every fleet.', required: 'Select at least one fleet' },
  reset: { title: 'Reset password', subtitle: (n: string) => `Set a new password for ${n}.`, label: 'New password', action: 'Reset password', done: 'Password reset' },
  perms: {
    title: 'Permissions', overwrite: 'Overwrite permissions', done: 'Done', resetToRole: 'Reset to role', customised: 'Customised', saved: 'Permissions saved',
    none: 'No features yet', notBuilt: 'No pages yet', all: (w: string) => `Select all ${w}`,
    locked: 'Press “Overwrite permissions” to change them.',
  },
} as const;

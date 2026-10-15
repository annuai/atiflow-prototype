/** Inline text of this area (see CLAUDE.md section 63): shared components, Users forms, Settings connections, validation messages. */
const and = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
export const misc = {
  ui: {
    noResults: 'No results',
    none: 'None',
    unassigned: 'Unassigned',
    quantity: 'Quantity',
    decrease: (what: string) => `Decrease ${what.toLowerCase()}`,
    increase: (what: string) => `Increase ${what.toLowerCase()}`,
    search: 'Search',
  },
  fleetSelect: { all: 'All fleets', fleet: 'Fleet' },
  userForm: {
    firstName: 'First Name',
    lastName: 'Last Name',
    username: 'Username',
    email: 'Email',
    title: 'Title',
    password: 'Password',
    roles: 'Roles',
    role: 'Role',
    firstNamePh: 'First name',
    lastNamePh: 'Last name',
    usernamePh: 'Username',
    emailPh: 'name@company.com',
    passwordPh: 'At least 4 characters',
    searchUsers: 'Search users',
    search: 'Search',
  },
  userValidation: {
    passwordShort: 'Use at least 4 characters',
    emailInvalid: 'Enter a valid email address',
    usernameShape: 'At least 3 letters, numbers, dots, dashes or underscores',
    usernameTaken: 'This username already exists',
    roleNotAssignable: (role: string) => `${role} cannot be assigned by you`,
  },
  settings: {
    synced: (name: string) => `${name} synced`,
    status: {
      issues: 'Connection issues detected',
      connected: 'Connected',
      notSet: (names: string[]) => `${and(names)} ${names.length > 1 ? 'are' : 'is'} not set.`,
      notValid: (names: string[]) => `${and(names)} ${names.length > 1 ? 'are' : 'is'} not valid.`,
    },
    validation: {
      host: 'Enter an IP address or a host name, e.g. 192.168.100.31',
      urlScheme: 'The address must start with http:// or https://',
      urlFull: 'Enter a full address, e.g. https://mes.example.com/amr',
    },
    tester: { noAnswer: (host: string) => `No answer from ${host} (timed out)`, reachable: 'Reachable' },
    connections: {
      fleetManager: {
        name: 'Fleet Manager',
        hostAddress: 'Host address',
        hostPlaceholder: '192.168.100.31 or fleet.example.com',
        clientId: 'Client ID',
        clientIdPlaceholder: 'The ID this app signs in with',
        credentials: 'Fleet Manager Credentials',
        clientSecret: 'Client secret',
        secretPlaceholder: 'The secret that goes with the Client ID',
        secretHint: 'Kept hidden. Enter a new one to replace it.',
      },
      mes: { name: 'MES Connections', amrUrl: 'AMR URL', bomUrl: 'BOM URL' },
    },
  },
} as const;

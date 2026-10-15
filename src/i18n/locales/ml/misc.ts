import type { Messages } from '../../types';
import type { misc } from '../en/misc';

const and = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')}, ${names[names.length - 1]}`;
export const messages: Messages<typeof misc> = {
  ui: {
    noResults: 'ഫലങ്ങളൊന്നുമില്ല',
    none: 'ഒന്നുമില്ല',
    unassigned: 'നൽകിയിട്ടില്ല',
    quantity: 'അളവ്',
    decrease: (what) => `${what} കുറയ്ക്കുക`,
    increase: (what) => `${what} കൂട്ടുക`,
    search: 'തിരയുക',
  },
  fleetSelect: { all: 'എല്ലാ ഫ്ലീറ്റുകളും', fleet: 'ഫ്ലീറ്റ്' },
  userForm: {
    firstName: 'ആദ്യ പേര്',
    lastName: 'അവസാന പേര്',
    username: 'ഉപയോക്തൃനാമം',
    email: 'ഇമെയിൽ',
    title: 'തസ്തിക',
    password: 'പാസ്‌വേഡ്',
    roles: 'റോളുകൾ',
    role: 'റോൾ',
    firstNamePh: 'ആദ്യ പേര്',
    lastNamePh: 'അവസാന പേര്',
    usernamePh: 'ഉപയോക്തൃനാമം',
    emailPh: 'name@company.com',
    passwordPh: 'കുറഞ്ഞത് 4 അക്ഷരങ്ങൾ',
    searchUsers: 'ഉപയോക്താക്കളെ തിരയുക',
    search: 'തിരയുക',
  },
  userValidation: {
    passwordShort: 'കുറഞ്ഞത് 4 അക്ഷരങ്ങൾ ഉപയോഗിക്കുക',
    emailInvalid: 'സാധുവായ ഇമെയിൽ വിലാസം നൽകുക',
    usernameShape: 'കുറഞ്ഞത് 3 അക്ഷരങ്ങൾ, അക്കങ്ങൾ, ഡോട്ടുകൾ, ഡാഷുകൾ അല്ലെങ്കിൽ അണ്ടർസ്കോർ',
    usernameTaken: 'ഈ ഉപയോക്തൃനാമം നിലവിലുണ്ട്',
    roleNotAssignable: (role) => `${role} റോൾ നിങ്ങൾക്ക് നൽകാൻ കഴിയില്ല`,
  },
  settings: {
    synced: (name) => `${name} സിങ്ക് ചെയ്തു`,
    status: {
      issues: 'കണക്ഷൻ പ്രശ്നങ്ങൾ കണ്ടെത്തി',
      connected: 'കണക്റ്റ് ചെയ്തു',
      notSet: (names) => `${and(names)} സജ്ജമാക്കിയിട്ടില്ല.`,
      notValid: (names) => `${and(names)} സാധുവല്ല.`,
    },
    validation: {
      host: 'ഒരു IP വിലാസമോ ഹോസ്റ്റ് പേരോ നൽകുക, ഉദാ. 192.168.100.31',
      urlScheme: 'വിലാസം http:// അല്ലെങ്കിൽ https:// ൽ തുടങ്ങണം',
      urlFull: 'പൂർണ്ണ വിലാസം നൽകുക, ഉദാ. https://mes.example.com/amr',
    },
    tester: { noAnswer: (host) => `${host} മറുപടി നൽകിയില്ല (സമയം കഴിഞ്ഞു)`, reachable: 'എത്തിച്ചേരാം' },
    connections: {
      fleetManager: {
        name: 'Fleet Manager',
        hostAddress: 'ഹോസ്റ്റ് വിലാസം',
        hostPlaceholder: '192.168.100.31 അല്ലെങ്കിൽ fleet.example.com',
        clientId: 'ക്ലയന്റ് ID',
        clientIdPlaceholder: 'ഈ ആപ്പ് സൈൻ ഇൻ ചെയ്യാൻ ഉപയോഗിക്കുന്ന ID',
        credentials: 'Fleet Manager ക്രെഡൻഷ്യലുകൾ',
        clientSecret: 'ക്ലയന്റ് സീക്രട്ട്',
        secretPlaceholder: 'ക്ലയന്റ് ID യോടൊപ്പമുള്ള സീക്രട്ട്',
        secretHint: 'മറച്ചിരിക്കുന്നു. മാറ്റാൻ പുതിയത് നൽകുക.',
      },
      mes: { name: 'MES കണക്ഷനുകൾ', amrUrl: 'AMR URL', bomUrl: 'BOM URL' },
    },
  },
};

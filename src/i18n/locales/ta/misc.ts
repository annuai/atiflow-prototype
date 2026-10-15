import type { Messages } from '../../types';
import type { misc } from '../en/misc';

const and = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} மற்றும் ${names[names.length - 1]}`;
export const messages: Messages<typeof misc> = {
  ui: {
    noResults: 'முடிவுகள் இல்லை',
    none: 'எதுவுமில்லை',
    unassigned: 'ஒதுக்கப்படவில்லை',
    quantity: 'அளவு',
    decrease: (what) => `${what} ஐக் குறை`,
    increase: (what) => `${what} ஐக் கூட்டு`,
    search: 'தேடு',
  },
  fleetSelect: { all: 'அனைத்து ஃப்ளீட்கள்', fleet: 'ஃப்ளீட்' },
  userForm: {
    firstName: 'முதல் பெயர்',
    lastName: 'கடைசி பெயர்',
    username: 'பயனர்பெயர்',
    email: 'மின்னஞ்சல்',
    title: 'பதவி',
    password: 'கடவுச்சொல்',
    roles: 'பாத்திரங்கள்',
    role: 'பாத்திரம்',
    firstNamePh: 'முதல் பெயர்',
    lastNamePh: 'கடைசி பெயர்',
    usernamePh: 'பயனர்பெயர்',
    emailPh: 'name@company.com',
    passwordPh: 'குறைந்தது 4 எழுத்துகள்',
    searchUsers: 'பயனர்களைத் தேடு',
    search: 'தேடு',
  },
  userValidation: {
    passwordShort: 'குறைந்தது 4 எழுத்துகளைப் பயன்படுத்தவும்',
    emailInvalid: 'சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்',
    usernameShape: 'குறைந்தது 3 எழுத்துகள், எண்கள், புள்ளிகள், கோடுகள் அல்லது அடிக்கோடுகள்',
    usernameTaken: 'இந்தப் பயனர்பெயர் ஏற்கனவே உள்ளது',
    roleNotAssignable: (role) => `${role} ஐ உங்களால் ஒதுக்க முடியாது`,
  },
  settings: {
    synced: (name) => `${name} ஒத்திசைக்கப்பட்டது`,
    status: {
      issues: 'இணைப்புச் சிக்கல்கள் கண்டறியப்பட்டன',
      connected: 'இணைக்கப்பட்டது',
      notSet: (names) => `${and(names)} அமைக்கப்படவில்லை.`,
      notValid: (names) => `${and(names)} செல்லாதது.`,
    },
    validation: {
      host: 'IP முகவரி அல்லது ஹோஸ்ட் பெயரை உள்ளிடவும், எ.கா. 192.168.100.31',
      urlScheme: 'முகவரி http:// அல்லது https:// உடன் தொடங்க வேண்டும்',
      urlFull: 'முழு முகவரியை உள்ளிடவும், எ.கா. https://mes.example.com/amr',
    },
    tester: { noAnswer: (host) => `${host} இலிருந்து பதில் இல்லை (நேரம் முடிந்தது)`, reachable: 'அணுகக்கூடியது' },
    connections: {
      fleetManager: {
        name: 'Fleet Manager',
        hostAddress: 'ஹோஸ்ட் முகவரி',
        hostPlaceholder: '192.168.100.31 அல்லது fleet.example.com',
        clientId: 'கிளையன்ட் ID',
        clientIdPlaceholder: 'இந்த செயலி உள்நுழைய பயன்படுத்தும் ID',
        credentials: 'Fleet Manager நற்சான்றுகள்',
        clientSecret: 'கிளையன்ட் ரகசியம்',
        secretPlaceholder: 'Client ID உடன் இணைந்த ரகசியம்',
        secretHint: 'மறைக்கப்பட்டுள்ளது. மாற்ற புதியதை உள்ளிடவும்.',
      },
      mes: { name: 'MES இணைப்புகள்', amrUrl: 'AMR URL', bomUrl: 'BOM URL' },
    },
  },
};

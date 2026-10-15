import type { Messages } from '../../types';
import type { misc } from '../en/misc';

const and = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} और ${names[names.length - 1]}`;
export const messages: Messages<typeof misc> = {
  ui: {
    noResults: 'कोई परिणाम नहीं',
    none: 'कोई नहीं',
    unassigned: 'असाइन नहीं',
    quantity: 'मात्रा',
    decrease: (what) => `${what} घटाएँ`,
    increase: (what) => `${what} बढ़ाएँ`,
    search: 'खोजें',
  },
  fleetSelect: { all: 'सभी फ़्लीट', fleet: 'फ़्लीट' },
  userForm: {
    firstName: 'पहला नाम',
    lastName: 'अंतिम नाम',
    username: 'यूज़रनेम',
    email: 'ईमेल',
    title: 'पदनाम',
    password: 'पासवर्ड',
    roles: 'भूमिकाएँ',
    role: 'भूमिका',
    firstNamePh: 'पहला नाम',
    lastNamePh: 'अंतिम नाम',
    usernamePh: 'यूज़रनेम',
    emailPh: 'name@company.com',
    passwordPh: 'कम से कम 4 अक्षर',
    searchUsers: 'उपयोगकर्ता खोजें',
    search: 'खोजें',
  },
  userValidation: {
    passwordShort: 'कम से कम 4 अक्षर रखें',
    emailInvalid: 'मान्य ईमेल पता दर्ज करें',
    usernameShape: 'कम से कम 3 अक्षर, अंक, बिंदु, डैश या अंडरस्कोर',
    usernameTaken: 'यह यूज़रनेम पहले से मौजूद है',
    roleNotAssignable: (role) => `${role} भूमिका आप नहीं दे सकते`,
  },
  settings: {
    synced: (name) => `${name} सिंक हो गया`,
    status: {
      issues: 'कनेक्शन में समस्याएँ मिलीं',
      connected: 'जुड़ा हुआ',
      notSet: (names) => `${and(names)} सेट नहीं ${names.length > 1 ? 'हैं' : 'है'}।`,
      notValid: (names) => `${and(names)} मान्य नहीं ${names.length > 1 ? 'हैं' : 'है'}।`,
    },
    validation: {
      host: 'IP पता या होस्ट नाम दर्ज करें, जैसे 192.168.100.31',
      urlScheme: 'पता http:// या https:// से शुरू होना चाहिए',
      urlFull: 'पूरा पता दर्ज करें, जैसे https://mes.example.com/amr',
    },
    tester: { noAnswer: (host) => `${host} से कोई जवाब नहीं मिला (समय समाप्त)`, reachable: 'पहुँच में' },
    connections: {
      fleetManager: {
        name: 'Fleet Manager',
        hostAddress: 'होस्ट पता',
        hostPlaceholder: '192.168.100.31 या fleet.example.com',
        clientId: 'क्लाइंट ID',
        clientIdPlaceholder: 'वह ID जिससे यह ऐप साइन इन करता है',
        credentials: 'Fleet Manager क्रेडेंशियल',
        clientSecret: 'क्लाइंट सीक्रेट',
        secretPlaceholder: 'क्लाइंट ID के साथ का सीक्रेट',
        secretHint: 'छिपा रहता है। बदलने के लिए नया दर्ज करें।',
      },
      mes: { name: 'MES कनेक्शन', amrUrl: 'AMR URL', bomUrl: 'BOM URL' },
    },
  },
};

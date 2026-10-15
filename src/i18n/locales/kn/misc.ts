import type { Messages } from '../../types';
import type { misc } from '../en/misc';

const and = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} ಮತ್ತು ${names[names.length - 1]}`;
export const messages: Messages<typeof misc> = {
  ui: {
    noResults: 'ಯಾವುದೇ ಫಲಿತಾಂಶಗಳಿಲ್ಲ',
    none: 'ಯಾವುದೂ ಇಲ್ಲ',
    unassigned: 'ನಿಯೋಜಿಸಿಲ್ಲ',
    quantity: 'ಪ್ರಮಾಣ',
    decrease: (what) => `${what} ಕಡಿಮೆ ಮಾಡಿ`,
    increase: (what) => `${what} ಹೆಚ್ಚಿಸಿ`,
    search: 'ಹುಡುಕಿ',
  },
  fleetSelect: { all: 'ಎಲ್ಲಾ ಫ್ಲೀಟ್‌ಗಳು', fleet: 'ಫ್ಲೀಟ್' },
  userForm: {
    firstName: 'ಮೊದಲ ಹೆಸರು',
    lastName: 'ಕೊನೆಯ ಹೆಸರು',
    username: 'ಬಳಕೆದಾರಹೆಸರು',
    email: 'ಇಮೇಲ್',
    title: 'ಹುದ್ದೆ',
    password: 'ಪಾಸ್‌ವರ್ಡ್',
    roles: 'ಪಾತ್ರಗಳು',
    role: 'ಪಾತ್ರ',
    firstNamePh: 'ಮೊದಲ ಹೆಸರು',
    lastNamePh: 'ಕೊನೆಯ ಹೆಸರು',
    usernamePh: 'ಬಳಕೆದಾರಹೆಸರು',
    emailPh: 'name@company.com',
    passwordPh: 'ಕನಿಷ್ಠ 4 ಅಕ್ಷರಗಳು',
    searchUsers: 'ಬಳಕೆದಾರರನ್ನು ಹುಡುಕಿ',
    search: 'ಹುಡುಕಿ',
  },
  userValidation: {
    passwordShort: 'ಕನಿಷ್ಠ 4 ಅಕ್ಷರಗಳನ್ನು ಬಳಸಿ',
    emailInvalid: 'ಮಾನ್ಯ ಇಮೇಲ್ ವಿಳಾಸ ನಮೂದಿಸಿ',
    usernameShape: 'ಕನಿಷ್ಠ 3 ಅಕ್ಷರಗಳು, ಅಂಕೆಗಳು, ಚುಕ್ಕೆಗಳು, ಡ್ಯಾಶ್ ಅಥವಾ ಅಂಡರ್‌ಸ್ಕೋರ್',
    usernameTaken: 'ಈ ಬಳಕೆದಾರಹೆಸರು ಈಗಾಗಲೇ ಇದೆ',
    roleNotAssignable: (role) => `${role} ಪಾತ್ರವನ್ನು ನೀವು ನೀಡಲು ಸಾಧ್ಯವಿಲ್ಲ`,
  },
  settings: {
    synced: (name) => `${name} ಸಿಂಕ್ ಆಯಿತು`,
    status: {
      issues: 'ಸಂಪರ್ಕದ ಸಮಸ್ಯೆಗಳು ಕಂಡುಬಂದಿವೆ',
      connected: 'ಸಂಪರ್ಕಗೊಂಡಿದೆ',
      notSet: (names) => `${and(names)} ಹೊಂದಿಸಿಲ್ಲ.`,
      notValid: (names) => `${and(names)} ಮಾನ್ಯವಾಗಿಲ್ಲ.`,
    },
    validation: {
      host: 'IP ವಿಳಾಸ ಅಥವಾ ಹೋಸ್ಟ್ ಹೆಸರು ನಮೂದಿಸಿ, ಉದಾ. 192.168.100.31',
      urlScheme: 'ವಿಳಾಸ http:// ಅಥವಾ https:// ನಿಂದ ಆರಂಭವಾಗಬೇಕು',
      urlFull: 'ಪೂರ್ಣ ವಿಳಾಸ ನಮೂದಿಸಿ, ಉದಾ. https://mes.example.com/amr',
    },
    tester: { noAnswer: (host) => `${host} ನಿಂದ ಪ್ರತಿಕ್ರಿಯೆ ಇಲ್ಲ (ಸಮಯ ಮೀರಿದೆ)`, reachable: 'ತಲುಪಬಹುದು' },
    connections: {
      fleetManager: {
        name: 'Fleet Manager',
        hostAddress: 'ಹೋಸ್ಟ್ ವಿಳಾಸ',
        hostPlaceholder: '192.168.100.31 ಅಥವಾ fleet.example.com',
        clientId: 'ಕ್ಲೈಂಟ್ ID',
        clientIdPlaceholder: 'ಈ ಆ್ಯಪ್ ಸೈನ್ ಇನ್ ಆಗಲು ಬಳಸುವ ID',
        credentials: 'Fleet Manager ರುಜುವಾತುಗಳು',
        clientSecret: 'ಕ್ಲೈಂಟ್ ಸೀಕ್ರೆಟ್',
        secretPlaceholder: 'ಕ್ಲೈಂಟ್ ID ಜೊತೆಗಿನ ಸೀಕ್ರೆಟ್',
        secretHint: 'ಮರೆಮಾಡಲಾಗಿದೆ. ಬದಲಾಯಿಸಲು ಹೊಸದನ್ನು ನಮೂದಿಸಿ.',
      },
      mes: { name: 'MES ಸಂಪರ್ಕಗಳು', amrUrl: 'AMR URL', bomUrl: 'BOM URL' },
    },
  },
};

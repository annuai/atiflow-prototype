import type { Messages } from '../../types';
import type { notifications } from '../en/notifications';

export const messages: Messages<typeof notifications> = {
  title: 'ಅಧಿಸೂಚನೆಗಳು',
  subtitle: {
    supervisor: 'ನಿಮ್ಮ ಅಗತ್ಯವಿರುವ ರೋಬೋಟ್‌ಗಳು, ನಡೆದಂತೆ.',
    configurator: 'MES ಮತ್ತು ನಿಮ್ಮ ಸೈಟ್ ಸೆಟಪ್‌ನ ಅಪ್‌ಡೇಟ್‌ಗಳು.',
    operator: 'ನಿಮ್ಮ ವಿನಂತಿಗಳ ಅಪ್‌ಡೇಟ್‌ಗಳು, ಮತ್ತು ನಿಮಗಾಗಿ ಕಾಯುತ್ತಿರುವ ವಿನಂತಿಗಳು.',
  },
  all: 'ಎಲ್ಲಾ',
  unread: (n) => `ಓದದಿರುವುದು${n ? ` (${n})` : ''}`,
  markAll: 'ಎಲ್ಲವನ್ನೂ ಓದಿದೆ ಎಂದು ಗುರುತಿಸಿ',
  clear: 'ಎಲ್ಲವನ್ನೂ ತೆರವುಗೊಳಿಸಿ',
  emptyAll: 'ಎಲ್ಲವೂ ನೋಡಿ ಆಗಿದೆ',
  emptyAllHint: {
    supervisor: 'ಅಡ್ಡಿಯಾದ, ಸಿಲುಕಿದ ಅಥವಾ ಬ್ಯಾಟರಿ ಕಡಿಮೆ ಇರುವ ರೋಬೋಟ್‌ಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.',
    configurator: 'ಹೊಸ MES ಡೇಟಾ ಮತ್ತು ಸ್ಟಾಕ್ ಅಪ್‌ಡೇಟ್‌ಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.',
    operator: 'ನಿಮ್ಮ ವಿನಂತಿಗಳ ಸ್ಥಿತಿ ಅಪ್‌ಡೇಟ್‌ಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.',
  },
  emptyUnread: 'ಓದದ ಅಧಿಸೂಚನೆಗಳಿಲ್ಲ',
  actions: {
    locate: 'ಪತ್ತೆಹಚ್ಚಿ',
    liveFloor: 'ಪೂರ್ಣ ನೋಟ',
    requests: 'ವಿನಂತಿ ನೋಡಿ',
    approvals: 'ಅನುಮೋದನೆಗಳನ್ನು ತೆರೆಯಿರಿ',
  },
  now: 'ಈಗಷ್ಟೇ',
  ago: { min: (n) => `${n} ನಿಮಿಷದ ಹಿಂದೆ`, hour: (n) => `${n} ಗಂಟೆ ಹಿಂದೆ`, day: (n) => `${n} ದಿನ ಹಿಂದೆ` },
};

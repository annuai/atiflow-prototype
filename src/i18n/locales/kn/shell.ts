import type { Messages } from '../../types';
import type { shell } from '../en/shell';

export const messages: Messages<typeof shell> = {
  menuOpen: 'ಮೆನು ತೆರೆಯಿರಿ',
  back: 'ಹಿಂದೆ',
  forward: 'ಮುಂದೆ',
  search: 'ಹುಡುಕಿ',
  support: 'ಬೆಂಬಲಕ್ಕೆ ಹೋಗಿ',
  ai: 'ಅತಿ AI',
  aiToast: 'ಅತಿ AI ಈ ಪ್ರೊಟೊಟೈಪ್‌ನ ಭಾಗವಲ್ಲ',
  logout: 'ಲಾಗ್ ಔಟ್',
  sidebarExpand: 'ಸೈಡ್‌ಬಾರ್ ವಿಸ್ತರಿಸಿ',
  sidebarCollapse: 'ಸೈಡ್‌ಬಾರ್ ಕುಗ್ಗಿಸಿ',
  comingSoon: 'ಶೀಘ್ರದಲ್ಲೇ ಬರಲಿದೆ',
  searchConfigurator: 'ರೋಬೋಟ್, ಸ್ಟೇಷನ್, ಝೋನ್ ಹುಡುಕಿ…',
  searchOperator: 'ಹುಡುಕಿ…',
  searchSupervisor: 'ಲೈವ್ ಕಾರ್ಯಾಚರಣೆ, ಫ್ಲೀಟ್, ಟ್ರಿಪ್, ಅನಾಲಿಟಿಕ್ಸ್ ಹುಡುಕಿ...',
  bootTitle: 'Ati Flow ನಿಮ್ಮ ಡೇಟಾವನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ',
  bootText: (failed) => `ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ: ${failed}. ಯಾವುದೂ ಬದಲಾಗಿಲ್ಲ. ನಿಮ್ಮ ಸಂಪರ್ಕ ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.`,
  tryAgain: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
  pageErrorTitle: 'ಈ ಪುಟವನ್ನು ತೋರಿಸಲಾಗಲಿಲ್ಲ',
  pageErrorText: 'ಇದನ್ನು ರಚಿಸುವಾಗ ಏನೋ ತಪ್ಪಾಯಿತು. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ; ಪದೇ ಪದೇ ಆದರೆ ಕಾನ್ಫಿಗರೇಟರ್‌ಗೆ ತಿಳಿಸಿ.',
  notSavedTitle: (what) => `${what} ನಲ್ಲಿನ ನಿಮ್ಮ ಬದಲಾವಣೆಗಳು ಉಳಿಯಲಿಲ್ಲ`,
  notSavedText: (why) => `${why} ಅವು ಪರದೆಯ ಮೇಲೆ ಉಳಿಯುತ್ತವೆ ಮತ್ತು ಮತ್ತೆ ಕೆಲಸ ಮಾಡಿದಾಗ ಉಳಿಸಲಾಗುತ್ತದೆ.`,
};

import type { Messages } from '../../types';
import type { shell } from '../en/shell';

export const messages: Messages<typeof shell> = {
  menuOpen: 'மெனுவைத் திற',
  back: 'பின்செல்',
  forward: 'முன்செல்',
  search: 'தேடு',
  support: 'ஆதரவுக்குச் செல்',
  ai: 'Ati AI',
  aiToast: 'Ati AI இந்த முன்மாதிரியில் இல்லை',
  logout: 'வெளியேறு',
  sidebarExpand: 'பக்கப்பட்டியை விரி',
  sidebarCollapse: 'பக்கப்பட்டியைச் சுருக்கு',
  comingSoon: 'விரைவில்',
  searchConfigurator: 'ரோபோக்கள், நிலையங்கள், மண்டலங்களைத் தேடுங்கள்…',
  searchOperator: 'தேடு…',
  searchSupervisor: 'நேரடி இயக்கங்கள், ஃப்ளீட்கள், பயணங்கள், பகுப்பாய்வுகளைத் தேடுங்கள்...',
  bootTitle: 'Ati Flow உங்கள் தரவை ஏற்ற முடியவில்லை',
  bootText: (failed) =>
    `ஏற்ற முடியவில்லை: ${failed}. எதுவும் மாற்றப்படவில்லை. இணைப்பைச் சரிபார்த்து மீண்டும் முயலவும்.`,
  tryAgain: 'மீண்டும் முயலவும்',
  pageErrorTitle: 'இந்தப் பக்கத்தைக் காட்ட முடியவில்லை',
  pageErrorText:
    'அதை வரையும்போது ஏதோ தவறு நடந்தது. மீண்டும் முயலவும்; தொடர்ந்து நடந்தால் கான்ஃபிகரேட்டரிடம் தெரிவிக்கவும்.',
  notSavedTitle: (what) => `${what} தொடர்பான உங்கள் மாற்றங்கள் சேமிக்கப்படவில்லை`,
  notSavedText: (why) => `${why} அவை திரையில் இருக்கும்; மீண்டும் இயங்கும்போது சேமிக்கப்படும்.`,
};

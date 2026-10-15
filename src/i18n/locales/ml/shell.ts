import type { Messages } from '../../types';
import type { shell } from '../en/shell';

export const messages: Messages<typeof shell> = {
  menuOpen: 'മെനു തുറക്കുക',
  back: 'പിന്നോട്ട്',
  forward: 'മുന്നോട്ട്',
  search: 'തിരയുക',
  support: 'സപ്പോർട്ടിലേക്ക് പോകുക',
  supportToast: 'പൂർണ്ണ ആപ്പിൽ നിന്ന് AtiFlow സപ്പോർട്ട് ഡെസ്കിനെ ബന്ധപ്പെടുക.',
  supportTitle: 'സപ്പോർട്ട്',
  ai: 'അതി AI',
  aiToast: 'അതി AI ഈ പ്രോട്ടോടൈപ്പിന്റെ ഭാഗമല്ല',
  logout: 'ലോഗ് ഔട്ട്',
  sidebarExpand: 'സൈഡ്ബാർ വികസിപ്പിക്കുക',
  sidebarCollapse: 'സൈഡ്ബാർ ചുരുക്കുക',
  comingSoon: 'ഉടൻ വരുന്നു',
  searchConfigurator: 'ലൈവ് പ്രവർത്തനങ്ങൾ, ഫ്ലീറ്റുകൾ, ട്രിപ്പുകൾ, അനലിറ്റിക്സ് തിരയുക...',
  searchOperator: 'തിരയുക…',
  searchSupervisor: 'റോബോട്ടുകൾ, സ്റ്റേഷനുകൾ, സോണുകൾ തിരയുക…',
  bootTitle: 'Ati Flow-ന് നിങ്ങളുടെ ഡാറ്റ ലോഡ് ചെയ്യാനായില്ല',
  bootText: (failed) => `ലോഡ് ചെയ്യാനായില്ല: ${failed}. ഒന്നും മാറ്റിയിട്ടില്ല. കണക്ഷൻ പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.`,
  tryAgain: 'വീണ്ടും ശ്രമിക്കുക',
  pageErrorTitle: 'ഈ പേജ് കാണിക്കാനായില്ല',
  pageErrorText: 'ഇത് വരയ്ക്കുമ്പോൾ എന്തോ പിഴച്ചു. വീണ്ടും ശ്രമിക്കുക; ആവർത്തിച്ചാൽ ഒരു കോൺഫിഗറേറ്ററെ അറിയിക്കുക.',
  notSavedTitle: (what) => `${what}-ലെ നിങ്ങളുടെ മാറ്റങ്ങൾ സേവ് ചെയ്തില്ല`,
  notSavedText: (why) => `${why} അവ സ്ക്രീനിൽ തുടരും, വീണ്ടും പ്രവർത്തിക്കുമ്പോൾ സേവ് ചെയ്യും.`,
};

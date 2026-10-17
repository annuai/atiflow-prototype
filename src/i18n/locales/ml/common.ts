import type { Messages } from '../../types';
import type { common } from '../en/common';

export const messages: Messages<typeof common> = {
  cancel: 'റദ്ദാക്കുക',
  save: 'സേവ് ചെയ്യുക',
  saveChanges: 'മാറ്റങ്ങൾ സേവ് ചെയ്യുക',
  delete: 'ഇല്ലാതാക്കുക',
  remove: 'നീക്കം ചെയ്യുക',
  edit: 'എഡിറ്റ് ചെയ്യുക',
  add: 'ചേർക്കുക',
  close: 'അടയ്ക്കുക',
  back: 'പിന്നോട്ട്',
  forward: 'മുന്നോട്ട്',
  search: 'തിരയുക',
  tryAgain: 'വീണ്ടും ശ്രമിക്കുക',
  required: 'ആവശ്യമാണ്',
  comingSoon: 'ഉടൻ വരുന്നു',
  language: 'ഭാഷ',
  noWebgl: {
    title: 'ഈ ബ്രൗസറിൽ 3D കാഴ്ച ലഭ്യമല്ല',
    body: 'നിങ്ങളുടെ ബ്രൗസറോ ഗ്രാഫിക്സ് ഡ്രൈവറോ WebGL 2 നൽകുന്നില്ല, 3D കാഴ്ചകൾക്ക് ഇത് വേണം. ബ്രൗസർ ക്രമീകരണങ്ങളിൽ ഹാർഡ്‌വെയർ ആക്സിലറേഷൻ ഓണാക്കുക, ബ്രൗസർ അപ്ഡേറ്റ് ചെയ്യുക, അല്ലെങ്കിൽ Ati Flow പുതിയ Chrome, Edge, Firefox അല്ലെങ്കിൽ Safari-യിൽ തുറക്കുക.',
  },
};

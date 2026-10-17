import type { Messages } from '../../types';
import type { common } from '../en/common';

export const messages: Messages<typeof common> = {
  cancel: 'रद्द करें',
  save: 'सहेजें',
  saveChanges: 'बदलाव सहेजें',
  delete: 'हटाएँ',
  remove: 'हटाएँ',
  edit: 'संपादित करें',
  add: 'जोड़ें',
  close: 'बंद करें',
  back: 'वापस',
  forward: 'आगे',
  search: 'खोजें',
  tryAgain: 'फिर कोशिश करें',
  required: 'आवश्यक',
  comingSoon: 'जल्द आ रहा है',
  language: 'भाषा',
  noWebgl: {
    title: 'इस ब्राउज़र में 3D व्यू उपलब्ध नहीं है',
    body: 'आपका ब्राउज़र या ग्राफ़िक्स ड्राइवर WebGL 2 नहीं देता, जो 3D व्यू के लिए ज़रूरी है। ब्राउज़र सेटिंग्स में हार्डवेयर एक्सेलेरेशन चालू करें, ब्राउज़र अपडेट करें, या Ati Flow को नए Chrome, Edge, Firefox या Safari में खोलें।',
  },
};

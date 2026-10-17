import type { Messages } from '../../types';
import type { common } from '../en/common';

export const messages: Messages<typeof common> = {
  cancel: 'ரத்துசெய்',
  save: 'சேமி',
  saveChanges: 'மாற்றங்களைச் சேமி',
  delete: 'நீக்கு',
  remove: 'அகற்று',
  edit: 'திருத்து',
  add: 'சேர்',
  close: 'மூடு',
  back: 'பின்செல்',
  forward: 'முன்செல்',
  search: 'தேடு',
  tryAgain: 'மீண்டும் முயலவும்',
  required: 'அவசியம்',
  comingSoon: 'விரைவில்',
  language: 'மொழி',
  noWebgl: {
    title: 'இந்த உலாவியில் 3D காட்சி கிடைக்கவில்லை',
    body: 'உங்கள் உலாவி அல்லது கிராபிக்ஸ் டிரைவர் WebGL 2 ஐ வழங்கவில்லை; 3D காட்சிகளுக்கு இது தேவை. உலாவி அமைப்புகளில் ஹார்டுவேர் முடுக்கத்தை இயக்கவும், உலாவியைப் புதுப்பிக்கவும், அல்லது Ati Flow ஐ புதிய Chrome, Edge, Firefox அல்லது Safari இல் திறக்கவும்.',
  },
};

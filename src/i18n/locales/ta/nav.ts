import type { Messages } from '../../types';
import type { nav } from '../en/nav';

export const messages: Messages<typeof nav> = {
  workspaces: {
    configurator: {
      title: 'கான்ஃபிகரேட்டர்',
      name: 'கான்ஃபிகரேட்டர்',
      blurb: 'ரோபோக்கள், வரைபடங்கள், வன்பொருள், முதன்மைத் தரவு, பணிப்பாய்வுகள், ஃப்ளீட்கள், அமைப்புகளை அமைக்கவும்',
    },
    supervisor: {
      title: 'மேற்பார்வையாளர்',
      name: 'மேற்பார்வையாளர்',
      blurb: 'தளத்தைக் கவனித்து ஃப்ளீட் எப்படி இயங்குகிறது என்பதைப் பாருங்கள்',
    },
    operator: {
      title: 'ஆபரேட்டர்',
      name: 'ஆபரேட்டர்',
      blurb:
        'பொருட்களைக் கோருங்கள், பயணங்களை முன்பதிவு செய்யுங்கள், கோரிக்கைகளை ஒப்புதல் அளியுங்கள், ரோபோ அழைப்புகளைக் கையாளுங்கள்',
    },
  },
  roles: {
    configurator: { label: 'கான்ஃபிகரேட்டர்', blurb: 'கட்டமைப்புக்கு முழு அணுகல், பயனர்களையும் நிர்வகிக்கலாம்' },
    supervisor: { label: 'மேற்பார்வையாளர்', blurb: 'டாஷ்போர்டு, அறிக்கைகள், நேரடி தளம் மற்றும் செயல் மையம்' },
    operator: { label: 'ஆபரேட்டர்', blurb: 'கோரிக்கை, பயண முன்பதிவு, ஒப்புதல், வரலாறு மற்றும் செயல் மையம்' },
  },
  features: {
    'configurator.robots': 'ரோபோக்கள்',
    'configurator.maps': 'வரைபடங்கள்',
    'configurator.hardware': 'வன்பொருள்',
    'configurator.master-data': 'முதன்மைத் தரவு',
    'configurator.workflows': 'பணிப்பாய்வுகள்',
    'configurator.fleets': 'ஃப்ளீட்கள்',
    'configurator.settings': 'அமைப்புகள்',
    'supervisor.dashboard': 'டாஷ்போர்டு',
    'supervisor.reports': 'அறிக்கைகள்',
    'supervisor.live-floor': 'நேரடி தளம்',
    'supervisor.action-center': 'செயல் மையம்',
    'supervisor.settings': 'அமைப்புகள்',
    'operator.request': 'கோரிக்கை',
    'operator.approve': 'ஒப்புதல்',
    'operator.book-trip': 'பயணம் முன்பதிவு',
    'operator.history': 'வரலாறு',
    'operator.action-center': 'செயல் மையம்',
    'operator.settings': 'அமைப்புகள்',
  },
  groups: { operations: 'இயக்கங்கள்', globalSetup: 'பொது அமைப்பு', build: 'உருவாக்கம்', fleets: 'ஃப்ளீட்கள்' },
  items: {
    users: 'பயனர்கள்',
    notifications: 'அறிவிப்புகள்',
    allFleets: 'அனைத்து ஃப்ளீட்கள்',
    createFleet: 'புதிய ஃப்ளீட்டை உருவாக்கு',
    fleetNameLabel: 'புதிய ஃப்ளீட் பெயர்',
    fleetNamePlaceholder: 'ஃப்ளீட் பெயர்',
    addFleet: 'சேர்',
  },
  hits: {
    robot: 'ரோபோ',
    trip: 'பயணம்',
    zone: 'மண்டலம்',
    station: 'நிலையம்',
    fleet: 'ஃப்ளீட்',
    hardware: 'வன்பொருள்',
  },
};

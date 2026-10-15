import type { Messages } from '../../types';
import type { nav } from '../en/nav';

export const messages: Messages<typeof nav> = {
  workspaces: {
    configurator: {
      title: 'कॉन्फ़िगरेटर',
      name: 'कॉन्फ़िगरेटर',
      blurb: 'रोबोट, मानचित्र, हार्डवेयर, मास्टर डेटा, वर्कफ़्लो, फ़्लीट और सेटिंग्स सेट करें',
    },
    supervisor: {
      title: 'सुपरवाइज़र',
      name: 'सुपरवाइज़र',
      blurb: 'फ़्लोर पर नज़र रखें और देखें कि फ़्लीट कैसा चल रहा है',
    },
    operator: {
      title: 'ऑपरेटर',
      name: 'ऑपरेटर',
      blurb: 'सामग्री मँगवाएँ, ट्रिप बुक करें, अनुरोध स्वीकृत करें और रोबोट कॉल सँभालें',
    },
  },
  roles: {
    configurator: { label: 'कॉन्फ़िगरेटर', blurb: 'कॉन्फ़िगरेशन की पूरी पहुँच, और उपयोगकर्ताओं का प्रबंधन' },
    supervisor: { label: 'सुपरवाइज़र', blurb: 'डैशबोर्ड, रिपोर्ट, लाइव फ़्लोर और एक्शन सेंटर' },
    operator: { label: 'ऑपरेटर', blurb: 'अनुरोध, ट्रिप बुकिंग, स्वीकृति, इतिहास और एक्शन सेंटर' },
  },
  features: {
    'configurator.robots': 'रोबोट',
    'configurator.maps': 'मानचित्र',
    'configurator.hardware': 'हार्डवेयर',
    'configurator.master-data': 'मास्टर डेटा',
    'configurator.workflows': 'वर्कफ़्लो',
    'configurator.fleets': 'फ़्लीट',
    'configurator.settings': 'सेटिंग्स',
    'supervisor.dashboard': 'डैशबोर्ड',
    'supervisor.reports': 'रिपोर्ट',
    'supervisor.live-floor': 'लाइव फ़्लोर',
    'supervisor.action-center': 'एक्शन सेंटर',
    'supervisor.settings': 'सेटिंग्स',
    'operator.request': 'अनुरोध',
    'operator.approve': 'स्वीकृति',
    'operator.book-trip': 'ट्रिप बुक करें',
    'operator.history': 'इतिहास',
    'operator.action-center': 'एक्शन सेंटर',
    'operator.settings': 'सेटिंग्स',
  },
  groups: { operations: 'संचालन', globalSetup: 'वैश्विक सेटअप', build: 'निर्माण', fleets: 'फ़्लीट' },
  items: {
    users: 'उपयोगकर्ता',
    notifications: 'सूचनाएँ',
    allFleets: 'सभी फ़्लीट',
    createFleet: 'नया फ़्लीट बनाएँ',
    fleetNameLabel: 'नए फ़्लीट का नाम',
    fleetNamePlaceholder: 'फ़्लीट का नाम',
    addFleet: 'जोड़ें',
  },
  hits: { robot: 'रोबोट', trip: 'ट्रिप', zone: 'ज़ोन', station: 'स्टेशन', fleet: 'फ़्लीट', hardware: 'हार्डवेयर' },
};

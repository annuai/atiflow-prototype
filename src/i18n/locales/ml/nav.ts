import type { Messages } from '../../types';
import type { nav } from '../en/nav';

export const messages: Messages<typeof nav> = {
  workspaces: {
    configurator: {
      title: 'കോൺഫിഗറേറ്റർ',
      name: 'കോൺഫിഗറേറ്റർ',
      blurb:
        'റോബോട്ടുകൾ, മാപ്പുകൾ, ഹാർഡ്‌വെയർ, മാസ്റ്റർ ഡാറ്റ, വർക്ക്ഫ്ലോകൾ, ഫ്ലീറ്റുകൾ, ക്രമീകരണങ്ങൾ എന്നിവ സജ്ജമാക്കുക',
    },
    supervisor: {
      title: 'സൂപ്പർവൈസർ',
      name: 'സൂപ്പർവൈസർ',
      blurb: 'ഫ്ലോർ നിരീക്ഷിക്കുക, ഫ്ലീറ്റ് എങ്ങനെ പ്രവർത്തിക്കുന്നു എന്ന് അറിയുക',
    },
    operator: {
      title: 'ഓപ്പറേറ്റർ',
      name: 'ഓപ്പറേറ്റർ',
      blurb:
        'മെറ്റീരിയൽ ആവശ്യപ്പെടുക, ട്രിപ്പ് ബുക്ക് ചെയ്യുക, അഭ്യർത്ഥനകൾ അംഗീകരിക്കുക, റോബോട്ട് കോളുകൾ കൈകാര്യം ചെയ്യുക',
    },
  },
  roles: {
    configurator: { label: 'കോൺഫിഗറേറ്റർ', blurb: 'കോൺഫിഗറേഷനിലേക്ക് പൂർണ്ണ പ്രവേശനം, ഉപയോക്താക്കളുടെ മാനേജ്മെന്റ്' },
    supervisor: { label: 'സൂപ്പർവൈസർ', blurb: 'ഡാഷ്ബോർഡ്, റിപ്പോർട്ടുകൾ, ലൈവ് ഫ്ലോർ, ആക്ഷൻ സെന്റർ' },
    operator: { label: 'ഓപ്പറേറ്റർ', blurb: 'അഭ്യർത്ഥന, ട്രിപ്പ് ബുക്കിംഗ്, അംഗീകാരം, ചരിത്രം, ആക്ഷൻ സെന്റർ' },
  },
  features: {
    'configurator.robots': 'റോബോട്ടുകൾ',
    'configurator.maps': 'മാപ്പുകൾ',
    'configurator.hardware': 'ഹാർഡ്‌വെയർ',
    'configurator.master-data': 'മാസ്റ്റർ ഡാറ്റ',
    'configurator.workflows': 'വർക്ക്ഫ്ലോകൾ',
    'configurator.fleets': 'ഫ്ലീറ്റുകൾ',
    'configurator.settings': 'ക്രമീകരണങ്ങൾ',
    'supervisor.dashboard': 'ഡാഷ്ബോർഡ്',
    'supervisor.reports': 'റിപ്പോർട്ടുകൾ',
    'supervisor.live-floor': 'ലൈവ് ഫ്ലോർ',
    'supervisor.action-center': 'ആക്ഷൻ സെന്റർ',
    'supervisor.settings': 'ക്രമീകരണങ്ങൾ',
    'operator.approve': 'അംഗീകാരം',
    'operator.book-trip': 'ട്രിപ്പ് ബുക്ക് ചെയ്യുക',
    'operator.history': 'ചരിത്രം',
    'operator.action-center': 'ആക്ഷൻ സെന്റർ',
    'operator.settings': 'ക്രമീകരണങ്ങൾ',
  },
  groups: { operations: 'പ്രവർത്തനങ്ങൾ', globalSetup: 'ഗ്ലോബൽ സെറ്റപ്പ്', build: 'നിർമ്മാണം', fleets: 'ഫ്ലീറ്റുകൾ' },
  items: {
    users: 'ഉപയോക്താക്കൾ',
    notifications: 'അറിയിപ്പുകൾ',
    allFleets: 'എല്ലാ ഫ്ലീറ്റുകളും',
    createFleet: 'പുതിയ ഫ്ലീറ്റ് സൃഷ്ടിക്കുക',
    fleetNameLabel: 'പുതിയ ഫ്ലീറ്റിന്റെ പേര്',
    fleetNamePlaceholder: 'ഫ്ലീറ്റിന്റെ പേര്',
    addFleet: 'ചേർക്കുക',
  },
  hits: {
    robot: 'റോബോട്ട്',
    trip: 'ട്രിപ്പ്',
    zone: 'സോൺ',
    station: 'സ്റ്റേഷൻ',
    fleet: 'ഫ്ലീറ്റ്',
    hardware: 'ഹാർഡ്‌വെയർ',
  },
};

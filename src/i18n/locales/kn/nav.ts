import type { Messages } from '../../types';
import type { nav } from '../en/nav';

export const messages: Messages<typeof nav> = {
  workspaces: {
    configurator: {
      title: 'ಕಾನ್ಫಿಗರೇಟರ್',
      name: 'ಕಾನ್ಫಿಗರೇಟರ್',
      blurb:
        'ರೋಬೋಟ್‌ಗಳು, ನಕ್ಷೆಗಳು, ಹಾರ್ಡ್‌ವೇರ್, ಮಾಸ್ಟರ್ ಡೇಟಾ, ವರ್ಕ್‌ಫ್ಲೋಗಳು, ಫ್ಲೀಟ್‌ಗಳು ಮತ್ತು ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ಹೊಂದಿಸಿ',
    },
    supervisor: {
      title: 'ಸೂಪರ್‌ವೈಸರ್',
      name: 'ಸೂಪರ್‌ವೈಸರ್',
      blurb: 'ಫ್ಲೋರ್ ಗಮನಿಸಿ ಮತ್ತು ಫ್ಲೀಟ್ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತಿದೆ ಎಂದು ತಿಳಿಯಿರಿ',
    },
    operator: {
      title: 'ಆಪರೇಟರ್',
      name: 'ಆಪರೇಟರ್',
      blurb: 'ವಸ್ತುಗಳನ್ನು ಕೇಳಿ, ಟ್ರಿಪ್ ಬುಕ್ ಮಾಡಿ, ವಿನಂತಿಗಳನ್ನು ಅನುಮೋದಿಸಿ ಮತ್ತು ರೋಬೋಟ್ ಕರೆಗಳನ್ನು ನಿರ್ವಹಿಸಿ',
    },
  },
  roles: {
    configurator: { label: 'ಕಾನ್ಫಿಗರೇಟರ್', blurb: 'ಕಾನ್ಫಿಗರೇಶನ್‌ಗೆ ಪೂರ್ಣ ಪ್ರವೇಶ, ಮತ್ತು ಬಳಕೆದಾರರ ನಿರ್ವಹಣೆ' },
    supervisor: { label: 'ಸೂಪರ್‌ವೈಸರ್', blurb: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್, ವರದಿಗಳು, ಲೈವ್ ಫ್ಲೋರ್ ಮತ್ತು ಆಕ್ಷನ್ ಸೆಂಟರ್' },
    operator: { label: 'ಆಪರೇಟರ್', blurb: 'ವಿನಂತಿ, ಟ್ರಿಪ್ ಬುಕಿಂಗ್, ಅನುಮೋದನೆ, ಇತಿಹಾಸ ಮತ್ತು ಆಕ್ಷನ್ ಸೆಂಟರ್' },
  },
  features: {
    'configurator.robots': 'ರೋಬೋಟ್‌ಗಳು',
    'configurator.maps': 'ನಕ್ಷೆಗಳು',
    'configurator.hardware': 'ಹಾರ್ಡ್‌ವೇರ್',
    'configurator.master-data': 'ಮಾಸ್ಟರ್ ಡೇಟಾ',
    'configurator.workflows': 'ವರ್ಕ್‌ಫ್ಲೋಗಳು',
    'configurator.fleets': 'ಫ್ಲೀಟ್‌ಗಳು',
    'configurator.settings': 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
    'supervisor.dashboard': 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    'supervisor.reports': 'ವರದಿಗಳು',
    'supervisor.live-floor': 'ಲೈವ್ ಫ್ಲೋರ್',
    'supervisor.action-center': 'ಆಕ್ಷನ್ ಸೆಂಟರ್',
    'supervisor.settings': 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
    'operator.approve': 'ಅನುಮೋದನೆ',
    'operator.book-trip': 'ಟ್ರಿಪ್ ಬುಕ್ ಮಾಡಿ',
    'operator.history': 'ಇತಿಹಾಸ',
    'operator.action-center': 'ಆಕ್ಷನ್ ಸೆಂಟರ್',
    'operator.settings': 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
  },
  groups: { operations: 'ಕಾರ್ಯಾಚರಣೆ', globalSetup: 'ಜಾಗತಿಕ ಸೆಟಪ್', build: 'ನಿರ್ಮಾಣ', fleets: 'ಫ್ಲೀಟ್‌ಗಳು' },
  items: {
    users: 'ಬಳಕೆದಾರರು',
    notifications: 'ಅಧಿಸೂಚನೆಗಳು',
    allFleets: 'ಎಲ್ಲಾ ಫ್ಲೀಟ್‌ಗಳು',
    createFleet: 'ಹೊಸ ಫ್ಲೀಟ್ ರಚಿಸಿ',
    fleetNameLabel: 'ಹೊಸ ಫ್ಲೀಟ್ ಹೆಸರು',
    fleetNamePlaceholder: 'ಫ್ಲೀಟ್ ಹೆಸರು',
    addFleet: 'ಸೇರಿಸಿ',
  },
  hits: { robot: 'ರೋಬೋಟ್', trip: 'ಟ್ರಿಪ್', zone: 'ಝೋನ್', station: 'ಸ್ಟೇಷನ್', fleet: 'ಫ್ಲೀಟ್', hardware: 'ಹಾರ್ಡ್‌ವೇರ್' },
};

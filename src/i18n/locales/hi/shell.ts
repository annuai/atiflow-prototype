import type { Messages } from '../../types';
import type { shell } from '../en/shell';

export const messages: Messages<typeof shell> = {
  menuOpen: 'मेनू खोलें',
  back: 'वापस',
  forward: 'आगे',
  search: 'खोजें',
  support: 'सहायता पर जाएँ',
  ai: 'अति AI',
  aiToast: 'अति AI इस प्रोटोटाइप का हिस्सा नहीं है',
  logout: 'लॉग आउट',
  sidebarExpand: 'साइडबार फैलाएँ',
  sidebarCollapse: 'साइडबार समेटें',
  comingSoon: 'जल्द आ रहा है',
  searchConfigurator: 'रोबोट, स्टेशन, ज़ोन खोजें…',
  searchOperator: 'खोजें…',
  searchSupervisor: 'लाइव संचालन, फ़्लीट, ट्रिप, एनालिटिक्स खोजें...',
  bootTitle: 'Ati Flow आपका डेटा लोड नहीं कर सका',
  bootText: (failed) => `लोड नहीं हो सका: ${failed}। कुछ भी नहीं बदला गया। अपना कनेक्शन जाँचें और फिर कोशिश करें।`,
  tryAgain: 'फिर कोशिश करें',
  pageErrorTitle: 'यह पेज नहीं दिखाया जा सका',
  pageErrorText: 'इसे बनाते समय कुछ गड़बड़ हुई। फिर कोशिश करें; बार-बार हो तो सहायता टिकट शुरू करें।',
  startTicket: 'सहायता टिकट शुरू करें',
  notSavedTitle: (what) => `${what} में आपके बदलाव सहेजे नहीं गए`,
  notSavedText: (why) => `${why} वे स्क्रीन पर बने रहेंगे और दोबारा काम करने पर सहेज लिए जाएँगे।`,
};

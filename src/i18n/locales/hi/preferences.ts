import type { Messages } from '../../types';
import type { preferences } from '../en/preferences';

export const messages: Messages<typeof preferences> = {
  title: 'सेटिंग्स',
  tabs: {
    alerts: {
      label: 'अलर्ट',
      subtitle: 'आपकी अपनी प्राथमिकताएँ: आपको किन समस्याओं की सूचना मिले, और कब। ये केवल आप पर लागू होती हैं।',
    },
    language: { label: 'भाषा', subtitle: 'इंटरफ़ेस की भाषा, केवल आपके लिए।' },
    start: { label: 'शुरुआती पेज', subtitle: 'आपके लिए ऐप कहाँ खुले।' },
  },
  alerts: {
    notify: 'मुझे इनकी सूचना दें',
    notifyHint: 'ये घंटी में और सूचनाएँ पेज पर दिखती हैं।',
    blocked: 'रुके हुए रोबोट',
    fault: 'रोबोट की खराबी',
    stuck: 'इंतज़ार में अटके रोबोट',
    battery: 'कम बैटरी',
    notifyAfter: 'रोबोट के इतना इंतज़ार करने पर सूचित करें',
    notifyAfterHint: '“इंतज़ार में अटका” सूचना के लिए।',
    warn: 'इंतज़ार कर रहे रोबोट को डैशबोर्ड पर इतने बाद दिखाएँ',
    warnHint: 'यह “ध्यान चाहिए” में दिखता है।',
    urgent: 'इतने बाद इसे अत्यावश्यक मानें',
    batteryLow: 'बैटरी इससे कम होने पर कम मानें',
    batteryLowHint: 'सूचना और डैशबोर्ड के लिए उपयोग होता है।',
  },
  start: {
    page: 'ऐप इस पेज पर खुले',
    pageHint: 'साइन इन करने के बाद, या ऐप खोलने पर।',
    last: 'जो पेज मैंने आख़िरी बार उपयोग किया',
    fleet: 'लाइव फ़्लोर इसके साथ खुले',
    fleetHint: 'साइडबार से लाइव फ़्लोर खोलने पर दिखने वाला फ़्लीट।',
  },
  language: { label: 'भाषा', hint: 'इंटरफ़ेस की भाषा, केवल आपके लिए।', siteDefault: 'साइट की डिफ़ॉल्ट' },
  save: 'बदलाव सहेजें',
  cancel: 'रद्द करें',
  saved: 'प्राथमिकताएँ सहेजी गईं',
  reset: 'डिफ़ॉल्ट पर लौटें',
  urgentLater: 'अत्यावश्यक का समय पहली चेतावनी के बाद होना चाहिए',
  seconds: (n) => `${n} सेकंड`,
  oneMinute: '1 मिनट',
  minutes: (n) => `${n} मिनट`,
  minSec: (m, s) => `${m} मि ${s} से`,
};

import type { Messages } from '../../types';
import type { settings } from '../en/settings';

export const messages: Messages<typeof settings> = {
  title: 'सेटिंग्स',
  tabs: {
    connections: { label: 'कनेक्शन', subtitle: 'वे सिस्टम जिनसे यह ऐप जुड़ता है, और क्या वे जवाब दे रहे हैं।' },
    general: { label: 'सामान्य', subtitle: 'इस साइट का नाम, माप और प्रदर्शन कैसे हो।' },
  },
  card: {
    edit: 'संपादित करें',
    test: 'कनेक्शन जाँचें',
    testing: 'जाँच हो रही है…',
    sync: 'अभी सिंक करें',
    syncing: 'सिंक हो रहा है…',
    notSet: 'सेट नहीं है',
    add: 'जोड़ें',
    lastSynced: 'पिछला सिंक',
    never: 'कभी नहीं',
    lastTest: (ok, ago) => `${ok ? 'पहुँच में' : 'विफल'} · ${ago} जाँचा गया`,
    notTested: 'अभी जाँचा नहीं गया',
  },
  edit: {
    title: (name) => `${name} संपादित करें`,
    subtitle: 'पता बदलने पर पिछला जाँच परिणाम हट जाता है। बाद में कनेक्शन जाँचें का उपयोग करें।',
    save: 'सहेजें',
    saved: (name) => `${name} सहेजा गया`,
    testOk: (name) => `${name} पहुँच में है`,
    testFail: (name) => `${name} ने जवाब नहीं दिया`,
  },
  general: {
    siteName: 'साइट का नाम',
    siteNameHint: 'जहाँ भी ऐप कारखाने का नाम दिखाता है, वहाँ दिखेगा।',
    timeZone: 'समय क्षेत्र',
    timeZoneHint: 'रिपोर्ट के लिए और यह तय करने के लिए कि “आज” क्या है।',
    units: 'इकाइयाँ',
    metric: 'मीट्रिक (मी, किमी)',
    imperial: 'इम्पीरियल (फ़ीट, मील)',
    language: 'भाषा',
    languageHint: 'इंटरफ़ेस की डिफ़ॉल्ट भाषा। हर व्यक्ति साइन-इन स्क्रीन पर या प्राथमिकताओं में अपनी भाषा चुन सकता है।',
    save: 'बदलाव सहेजें',
    cancel: 'रद्द करें',
    saved: 'सेटिंग्स सहेजी गईं',
    note: 'ये साइट के साथ सहेजी जाती हैं। इकाइयाँ अभी पूरे ऐप में लागू नहीं हैं।',
  },
};

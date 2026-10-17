import type { Messages } from '../../types';
import type { masterData } from '../en/masterData';

const count = (c: number) => c.toLocaleString('en-IN');

export const messages: Messages<typeof masterData> = {
  title: 'मास्टर डेटा',
  tabs: {
    materials: {
      label: 'सामग्री',
      subtitle: 'वर्कफ़्लो बिल्डर में इस्तेमाल होने वाली सामग्रियाँ और सामग्री समूह प्रबंधित करें।',
    },
    'staging-area': { label: 'स्टेजिंग एरिया', subtitle: 'स्टेजिंग एरिया प्रबंधित करें' },
  },
  materials: {
    note: 'यहाँ सिर्फ़ सामग्री सूची से चुनी गई सामग्रियाँ दिखती हैं। एक बार जोड़ने पर सामग्री हटाई नहीं जा सकती, क्योंकि वह वर्कफ़्लो में इस्तेमाल हो सकती है।',
    searchPlaceholder: 'सामग्री समूह, कोड, नाम से सामग्री खोजें',
    allGroups: 'सभी समूह',
    groupFilter: (name) => `समूह: ${name}`,
    addMore: 'API से और जोड़ें',
    add: 'सामग्री जोड़ें',
    columns: { material: 'सामग्री', group: 'सामग्री समूह', fleet: 'फ़्लीट' },
    groupHint: 'वह समूह जिसमें सामग्री आती है',
    fleetHint: 'वे फ़्लीट जिन्हें यह सामग्री असाइन है। सामग्री फ़्लीट के पेज से असाइन करें।',
    unassigned: 'असाइन नहीं',
    noGroup: '—',
    noMatch: (q) => `“${q}” से कोई सामग्री मेल नहीं खाती।`,
    empty: {
      title: 'अभी कोई सामग्री नहीं',
      description:
        'अपने ERP से सामग्रियाँ इम्पोर्ट करें, फ़ाइल अपलोड करें या हाथ से जोड़ें। वर्कफ़्लो सिर्फ़ वही सामग्रियाँ इस्तेमाल कर सकते हैं जो उनके फ़्लीट को असाइन हैं।',
      action: 'सामग्री जोड़ें',
    },
    rowMenu: { label: 'पंक्ति की कार्रवाइयाँ', edit: 'विवरण संपादित करें', fleets: 'फ़्लीट प्रबंधित करें' },
  },
  fleets: {
    inUse: {
      title: 'असाइन हटाने से पहले सामग्री को वर्कफ़्लो से हटाएँ',
      body: (code, fleets) => `${code} का उपयोग ${fleets.join(', ')} में हो रहा है।`,
    },
    title: (code) => `${code} के लिए फ़्लीट`,
    subtitle: 'किसी फ़्लीट का वर्कफ़्लो बिल्डर सिर्फ़ उसे असाइन सामग्रियाँ ही दिखाता है।',
    save: 'सहेजें',
    none: 'अभी कोई फ़्लीट नहीं है।',
  },
  edit: {
    title: 'सामग्री संपादित करें',
    subtitle: 'नाम या समूह बदलें। कोड नहीं बदला जा सकता।',
    save: 'बदलाव सहेजें',
    saved: 'सामग्री अपडेट हो गई',
  },
  method: {
    title: 'सामग्री जोड़ें',
    subtitle: 'चुनें कि आप अपने मास्टर डेटा में सामग्री कैसे जोड़ना चाहते हैं।',
    cancel: 'रद्द करें',
    next: 'जारी रखें',
    options: {
      api: { title: 'API से इम्पोर्ट करें', description: 'अपने ERP या इन्वेंटरी सिस्टम से सीधे सामग्री सिंक करें।' },
      file: {
        title: 'CSV/XLSX फ़ाइल से इम्पोर्ट करें',
        description: 'एक साथ कई सामग्रियाँ जोड़ने के लिए फ़ाइल अपलोड करें।',
      },
      manual: {
        title: 'सामग्री का विवरण हाथ से भरें',
        description: 'विवरण भरकर एक सामग्री जोड़ें।',
      },
    },
  },
  api: {
    title: 'API से इम्पोर्ट करें',
    subtitle: 'अपनी मुख्य सामग्री सूची में शामिल करने के लिए सामग्रियाँ चुनें।',
    addMoreTitle: 'API से और जोड़ें',
    addMoreSubtitle:
      'वे सामग्रियाँ चुनें जो अभी आपकी सूची में नहीं हैं। पहले से जोड़ी गई सामग्रियाँ लॉक हैं और हटाई नहीं जा सकतीं।',
    searchLabel: 'सामग्री खोजें',
    searchPlaceholder: 'नाम, कोड, विवरण से खोजें',
    prefixLabel: 'कोड उपसर्ग',
    prefixAddon: 'से शुरू',
    prefixPlaceholder: 'जैसे DCP',
    showing: (total) => `API से ${count(total)} सामग्रियाँ दिख रही हैं`,
    withPrefix: (total, prefix) => `${count(total)} सामग्री जिनका कोड “${prefix}” से शुरू होता है`,
    sourceName: 'API',
    selectAll: (n) => `सभी ${n} परिणाम चुनें`,
    selectingAll: 'चुन रहे हैं…',
    clearSelection: 'चयन हटाएं',
    loadingMore: 'और लोड हो रहा है…',
    failed: 'मटेरियल API तक नहीं पहुँचा जा सका।',
    retry: 'फिर कोशिश करें',
    loading: 'खोज हो रही है…',
    none: 'आपकी खोज से कोई सामग्री मेल नहीं खाती।',
    selected: (n) => `${count(n)} चुनी गईं`,
    cancel: 'रद्द करें',
    create: (n) => (n ? `सामग्री सूची बनाएँ (${n})` : 'सामग्री सूची बनाएँ'),
    add: (n) => (n ? `${count(n)} सामग्री जोड़ें` : 'सामग्री जोड़ें'),
    done: (n) => ({
      title: 'नई सामग्री जोड़ी गई',
      body: `${count(n)} सामग्री सफलतापूर्वक जोड़ी गई`,
    }),
  },
  picker: {
    material: 'सामग्री',
    code: 'सामग्री कोड',
    group: 'सामग्री समूह',
    status: 'स्थिति',
    status_available: 'उपलब्ध',
    status_added: 'जोड़ी गई',
    status_duplicate: 'डुप्लिकेट',
    status_invalid: 'अमान्य',
  },
  upload: {
    title: 'CSV/XLSX फ़ाइल से इम्पोर्ट करें',
    stepOf: (n, total, what) => `चरण ${n} / ${total} · ${what}`,
    uploadStep: 'हर पंक्ति में एक सामग्री वाली CSV या XLSX फ़ाइल अपलोड करें।',
    dropLink: 'अपलोड करने के लिए क्लिक करें',
    dropText: ' या खींचकर छोड़ें',
    hint: (types, mb) => `${types} (अधिकतम ${mb} MB)`,
    template: 'टेम्पलेट डाउनलोड करें',
    fileInfo: (rows) => `${count(rows)} पंक्तियाँ मिलीं`,
    back: 'वापस',
    next: 'जारी रखें',
    errors: {
      format: {
        title: 'फ़ाइल प्रारूप समर्थित नहीं',
        message:
          'यह फ़ाइल ऐसे प्रारूप में है जो AtiFlow के साथ संगत नहीं है। कृपया टेम्पलेट इस्तेमाल करें और अपडेट की हुई फ़ाइल दोबारा अपलोड करें।',
      },
      size: {
        title: 'फ़ाइल बहुत बड़ी है',
        message: 'यह फ़ाइल तय सीमा से बड़ी है। इसे छोटी फ़ाइलों में बाँटें और एक-एक करके अपलोड करें।',
      },
      empty: {
        title: 'कोई सामग्री नहीं मिली',
        message:
          'फ़ाइल में सामग्री की कोई पंक्ति नहीं है। टेम्पलेट इस्तेमाल करें और अपडेट की हुई फ़ाइल दोबारा अपलोड करें।',
      },
      columns: {
        title: 'कॉलम गायब हैं',
        message: (names) =>
          `फ़ाइल में ये कॉलम चाहिए: ${names.join(', ')}। कृपया टेम्पलेट इस्तेमाल करें और अपडेट की हुई फ़ाइल दोबारा अपलोड करें।`,
      },
    },
  },
  review: {
    title: 'इम्पोर्ट की समीक्षा',
    rowsFound: (rows, file) => `${file} में ${count(rows)} पंक्तियाँ मिलीं।`,
    back: 'वापस',
    import: (n) => (n ? `${count(n)} सामग्री इम्पोर्ट करें` : 'सामग्री इम्पोर्ट करें'),
  },
  progress: {
    title: 'सामग्री इम्पोर्ट हो रही है',
    body: (n, file) =>
      `${file} से ${count(n)} सामग्री जोड़ी जा रही है। आप यह विंडो बंद कर सकते हैं, इम्पोर्ट चलता रहेगा।`,
    count: (done, total) => `${count(total)} में से ${count(done)} सामग्री इम्पोर्ट हुई`,
    cancel: 'इम्पोर्ट रद्द करें',
    background: 'बैकग्राउंड में चलाएँ',
    cancelled: (done) => ({
      title: 'इम्पोर्ट रद्द हुआ',
      body: `${count(done)} सामग्री पहले ही जोड़ी जा चुकी थी और सूची में रहेगी।`,
    }),
    done: (n) => ({
      title: 'नई सामग्री जोड़ी गई',
      body: `${count(n)} सामग्री सफलतापूर्वक जोड़ी गई`,
    }),
  },
  manual: {
    title: 'सामग्री जोड़ें',
    subtitle: 'एक सामग्री का विवरण दर्ज करें।',
    nameLabel: 'सामग्री का नाम',
    namePlaceholder: 'जैसे Steel Bracket 40mm',
    codeLabel: 'सामग्री कोड',
    codePlaceholder: 'MAT001',
    groupLabel: 'सामग्री समूह',
    cancel: 'रद्द करें',
    submit: 'सामग्री जोड़ें',
    done: { title: 'नई सामग्री जोड़ी गई', body: 'नई सामग्री सफलतापूर्वक जोड़ी गई' },
  },
  staging: {
    cardUtilisation: 'उपयोग में सेल',
    layoutTitle: (name) => `${name} सेल लेआउट`,
    selected: 'चुना हुआ',
    modes: { view: 'देखें', manage: 'प्रबंधित करें' },
    manageHint:
      'किसी उपलब्ध या ब्लॉक सेल पर क्लिक करके उसे ब्लॉक या रिलीज़ करें। आरक्षित और भरे सेल वर्कफ़्लो से नियंत्रित होते हैं।',
    cellLabel: (row, col, state) => `पंक्ति ${row}, कॉलम ${col}: ${state}`,
    empty: 'स्टेजिंग एरिया सेट होते ही यहाँ दिखेंगे।',
  },
  time: { justNow: 'अभी-अभी' },
  emptyTitles: { fleets: 'अभी कोई फ़्लीट नहीं', staging: 'अभी कोई स्टेजिंग एरिया नहीं' },
};

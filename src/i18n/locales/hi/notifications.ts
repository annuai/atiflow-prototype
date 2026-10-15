import type { Messages } from '../../types';
import type { notifications } from '../en/notifications';

export const messages: Messages<typeof notifications> = {
  title: 'नोटिफ़िकेशन',
  subtitle: {
    supervisor: 'जिन रोबोट को आपकी ज़रूरत है, वे होते ही यहाँ।',
    configurator: 'MES और आपकी साइट सेटअप के अपडेट।',
    operator: 'आपके अनुरोधों के अपडेट, और आपकी प्रतीक्षा कर रहे अनुरोध।',
  },
  all: 'सभी',
  unread: (n) => `अनपढ़े${n ? ` (${n})` : ''}`,
  markAll: 'सभी को पढ़ा हुआ चिह्नित करें',
  clear: 'सब साफ़ करें',
  emptyAll: 'आप सब देख चुके हैं',
  emptyAllHint: {
    supervisor: 'रुके, फँसे या कम बैटरी वाले रोबोट यहाँ दिखेंगे।',
    configurator: 'MES का नया डेटा और स्टॉक अपडेट यहाँ दिखेंगे।',
    operator: 'आपके अनुरोधों के स्टेटस अपडेट यहाँ दिखेंगे।',
  },
  emptyUnread: 'कोई अनपढ़ा नोटिफ़िकेशन नहीं',
  actions: { locate: 'खोजें', liveFloor: 'पूरा दृश्य', requests: 'अनुरोध देखें', approvals: 'मंज़ूरियाँ खोलें' },
  now: 'अभी-अभी',
  ago: {
    min: (n) => `${n} मिनट पहले`,
    hour: (n) => `${n} घंटे पहले`,
    day: (n) => `${n} दिन पहले`,
  },
};

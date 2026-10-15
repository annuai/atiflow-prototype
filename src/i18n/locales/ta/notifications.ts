import type { Messages } from '../../types';
import type { notifications } from '../en/notifications';

export const messages: Messages<typeof notifications> = {
  title: 'அறிவிப்புகள்',
  subtitle: {
    supervisor: 'உங்கள் தேவை உள்ள ரோபோக்கள், நிகழும்போதே.',
    configurator: 'MES மற்றும் உங்கள் தள அமைப்பிலிருந்து புதுப்பிப்புகள்.',
    operator: 'உங்கள் கோரிக்கைகளின் புதுப்பிப்புகள் மற்றும் உங்களுக்காகக் காத்திருக்கும் கோரிக்கைகள்.',
  },
  all: 'அனைத்தும்',
  unread: (n) => `படிக்காதவை${n ? ` (${n})` : ''}`,
  markAll: 'அனைத்தையும் படித்ததாகக் குறி',
  clear: 'அனைத்தையும் அழி',
  emptyAll: 'அனைத்தும் பார்த்துவிட்டீர்கள்',
  emptyAllHint: {
    supervisor: 'தடைபட்ட, சிக்கிய அல்லது பேட்டரி குறைந்த ரோபோக்கள் இங்கே தெரியும்.',
    configurator: 'புதிய MES தரவும் இருப்புப் புதுப்பிப்புகளும் இங்கே தெரியும்.',
    operator: 'உங்கள் கோரிக்கைகளின் நிலைப் புதுப்பிப்புகள் இங்கே தெரியும்.',
  },
  emptyUnread: 'படிக்காத அறிவிப்புகள் இல்லை',
  actions: {
    locate: 'கண்டறி',
    liveFloor: 'முழுக் காட்சி',
    requests: 'கோரிக்கையைப் பார்',
    approvals: 'அங்கீகாரங்களைத் திற',
  },
  now: 'இப்போதுதான்',
  ago: {
    min: (n) => `${n} நிமிடம் முன்`,
    hour: (n) => `${n} மணி முன்`,
    day: (n) => `${n} நாள் முன்`,
  },
};

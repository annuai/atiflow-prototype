import { useEffect } from 'react';
import { useAuth } from '@/features/auth';
import { useMyPreferences } from '@/features/preferences';
import { useSettings } from '@/features/settings';
import { chooseLocale, showLocale } from '@/i18n';
import { services } from '@/services';

/** Keeps the language in step with who is signed in: the person's own choice, else this device's (sign-in screen), else the site default. Renders nothing. */
export function LocaleSync() {
  const signedIn = useAuth((s) => !!s.user);
  const mine = useMyPreferences().language;
  const site = useSettings((s) => s.general.language);
  useEffect(() => {
    void showLocale(
      chooseLocale({
        person: signedIn && mine !== 'site' ? mine : null,
        device: services().device.get('locale'),
        site,
      }),
    );
  }, [signedIn, mine, site]);
  return null;
}

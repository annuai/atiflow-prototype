import { useEffect, useState } from 'react';
import { LANGUAGES } from '@/i18n/languages';
import { useLocale } from '@/i18n/store';
import { backAtLabel } from './hours';
import { supportService, useSupport } from './store';
import type { SupportStatus } from './types';

/** Support hours as they are right now (re-read every 30 s and whenever the demo toggle changes), with the reopening time ready to show in India time and the viewer's. */
export function useSupportStatus(): SupportStatus & { backAt: string } {
  const hoursFlag = useSupport((s) => s.dev.hours);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const id = useLocale();
  const locale = LANGUAGES.find((l) => l.id === id)?.intl ?? 'en-GB';
  void hoursFlag;
  const s = supportService.getSupportStatus();
  return { ...s, backAt: backAtLabel(s.nextOpenAt, locale) };
}

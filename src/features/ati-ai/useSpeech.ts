import { useCallback, useEffect, useRef, useState } from 'react';
import { LANGUAGES } from '@/i18n/languages';
import { useLocale } from '@/i18n/store';

/** The slice of the browser's speech recognition that is used (it is not in TypeScript's DOM types). */
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type Ctor = new () => Recognition;
const ctorOf = (): Ctor | null => {
  if (typeof window === 'undefined' || !window.isSecureContext) return null; // the browser only allows the microphone on a secure page (https or localhost)
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
export type SpeechProblem = 'unsupported' | 'denied' | 'silence';

/**
 * Talk to the assistant: the browser's speech recognition in the interface language. While the person speaks the words stream into `onInterim`; when they stop, the sentence goes to `onFinal`
 * (the assistant answers straight away, like a spoken question). Nothing is recorded or stored by the app.
 */
export function useSpeech(cb: {
  onInterim(t: string): void;
  onFinal(t: string): void;
  onProblem(p: SpeechProblem): void;
}) {
  const locale = useLocale();
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const handlers = useRef(cb);
  useEffect(() => {
    handlers.current = cb;
  });
  useEffect(() => () => rec.current?.abort(), []);
  const supported = ctorOf() !== null;
  const stop = useCallback(() => rec.current?.stop(), []);
  const start = useCallback(() => {
    const C = ctorOf();
    if (!C) return handlers.current.onProblem('unsupported');
    const r = new C();
    r.lang = LANGUAGES.find((l) => l.id === locale)?.intl ?? 'en-GB';
    r.interimResults = true;
    r.continuous = false;
    let heard = '';
    let final = false;
    r.onresult = (e) => {
      const text = Array.from(e.results as ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>)
        .map((x) => x[0].transcript)
        .join(' ')
        .trim();
      heard = text;
      final = Array.from(e.results).every((x) => x.isFinal);
      handlers.current.onInterim(text);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') handlers.current.onProblem('denied');
      else if (e.error === 'no-speech') handlers.current.onProblem('silence');
    };
    r.onend = () => {
      setListening(false);
      rec.current = null;
      if (heard && (final || heard.length > 0)) handlers.current.onFinal(heard);
    };
    rec.current = r;
    setListening(true);
    r.start();
  }, [locale]);
  return { supported, listening, start, stop };
}

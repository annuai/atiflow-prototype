import { useEffect, useRef, useState } from 'react';
import { Microphone01, Send01, StopCircle } from '@untitledui/icons';
import { copy } from '../copy';
import type { Role } from '../types';
import { useSpeech, type SpeechProblem } from '../useSpeech';

const PROBLEM = { unsupported: 'micUnsupported', denied: 'micDenied', silence: 'noSpeech' } as const;

/**
 * The box pinned to the bottom. The main button is the MICROPHONE: tap it and talk, the words appear as you speak and are sent when you stop. Once something is typed the button becomes Send.
 * Enter sends, Shift+Enter starts a new line, and the box takes focus whenever the panel opens.
 */
export function Composer({
  role,
  busy,
  focusKey,
  onSend,
}: {
  role: Role;
  busy: boolean;
  focusKey: boolean;
  onSend(text: string): void;
}) {
  const [value, setValue] = useState('');
  const [problem, setProblem] = useState<SpeechProblem | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const speech = useSpeech({
    onInterim: (t) => setValue(t),
    onFinal: (t) => {
      setValue('');
      if (!busy) onSend(t);
    },
    onProblem: setProblem,
  });
  useEffect(() => {
    if (focusKey) box.current?.focus();
  }, [focusKey]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 44), 140)}px`;
  }, [value]);
  const submit = () => {
    const t = value.trim();
    if (!t || busy) return;
    setValue('');
    onSend(t);
  };
  const typing = value.trim().length > 0 && !speech.listening;
  const placeholder = speech.listening ? copy.composer.listening : copy.composer[role];
  return (
    <>
      {problem && (
        <p className="ai-mic-problem" role="status">
          {copy.composer[PROBLEM[problem]]}
        </p>
      )}
      <form
        className={`ai-composer${speech.listening ? ' ai-listening' : ''}`}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={box}
          rows={1}
          value={value}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-describedby="ai-hint"
          onChange={(e) => {
            setProblem(null);
            setValue(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {typing ? (
          <button type="submit" className="ai-send" aria-label={copy.composer.send} disabled={busy}>
            <Send01 aria-hidden className="size-5" />
          </button>
        ) : (
          <button
            type="button"
            className={`ai-send ai-mic${speech.listening ? ' ai-mic-on' : ''}`}
            aria-label={speech.listening ? copy.composer.stopMic : copy.composer.mic}
            aria-pressed={speech.listening}
            title={speech.supported ? undefined : copy.composer.micUnsupported}
            disabled={busy && !speech.listening}
            onClick={() => {
              setProblem(null);
              if (!speech.supported) return setProblem('unsupported');
              if (speech.listening) speech.stop();
              else speech.start();
            }}
          >
            {speech.listening ? (
              <StopCircle aria-hidden className="size-6" />
            ) : (
              <Microphone01 aria-hidden className="size-6" />
            )}
          </button>
        )}
        <span id="ai-hint" className="ai-sr">
          {copy.composer.hint}
        </span>
      </form>
    </>
  );
}

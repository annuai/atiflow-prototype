import { useState } from 'react';
import { ThumbsDown, ThumbsUp } from '@untitledui/icons';
import { copy } from '../copy';
import { PRIMARY, SECONDARY } from './parts';

/** "How was your support?": thumbs up or down and an optional comment. */
export function Csat({ onSubmit }: { onSubmit(score: 'up' | 'down', comment: string): void }) {
  const [score, setScore] = useState<'up' | 'down' | null>(null);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  if (done) return <p className="rounded-xl bg-secondary p-3 text-sm text-secondary">{copy.csat.thanks}</p>;
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-secondary p-3" aria-label={copy.csat.title}>
      <h3 className="text-sm font-semibold text-primary">{copy.csat.title}</h3>
      <div className="flex gap-2" role="group">
        {(['up', 'down'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={score === s}
            onClick={() => setScore(s)}
            className={`${score === s ? PRIMARY : SECONDARY} flex-1 gap-2`}
          >
            {s === 'up' ? <ThumbsUp aria-hidden className="size-5" /> : <ThumbsDown aria-hidden className="size-5" />}
            {copy.csat[s]}
          </button>
        ))}
      </div>
      {score && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={copy.csat.comment}
            aria-label={copy.csat.comment}
            rows={2}
            className="rounded-lg border border-primary bg-primary p-2 text-sm text-primary outline-focus-ring focus-visible:outline-2"
          />
          <button
            type="button"
            className={PRIMARY}
            onClick={() => {
              setDone(true);
              onSubmit(score, comment.trim());
            }}
          >
            {copy.csat.send}
          </button>
        </>
      )}
    </section>
  );
}

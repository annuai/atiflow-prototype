import { useEffect, useState } from 'react';
import type { Block, Chip } from '../../types';
import { copy } from '../../copy';

export type OnChip = (chip: Chip) => void;

/** A reply's text, revealed word by word while the reply is new (never for restored history); `**` and bullet lines are kept as written. */
export function TextBlock({ text, animate }: { text: string; animate: boolean }) {
  const words = text.split(/(\s+)/);
  const [n, setN] = useState(animate ? 0 : words.length);
  const shown = animate ? n : words.length;
  useEffect(() => {
    if (!animate || n >= words.length) return;
    const t = window.setTimeout(() => setN((x) => Math.min(words.length, x + 2)), 28);
    return () => window.clearTimeout(t);
  }, [animate, n, words.length]);
  return <p className="ai-text">{words.slice(0, shown).join('')}</p>;
}

export function ChipRow({ chips, onChip, disabled }: { chips: Chip[]; onChip: OnChip; disabled?: boolean }) {
  return (
    <div className="ai-chips" role="group">
      {chips.map((c, i) => (
        <button key={`${c.id}-${i}`} type="button" className="ai-chip" disabled={disabled} onClick={() => onChip(c)}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function ActionsRow({ actions, onChip, disabled }: { actions: Chip[]; onChip: OnChip; disabled?: boolean }) {
  return (
    <div className="ai-actions">
      {actions.map((c, i) => (
        <button
          key={`${c.id}-${i}`}
          type="button"
          className="ai-btn ai-btn-ghost"
          disabled={disabled}
          onClick={() => onChip(c)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/** A write needs a yes: the card says exactly what will happen, and nothing changes before Confirm. */
export function ConfirmationCard({
  block,
  onConfirm,
  onEdit,
  onCancel,
  disabled,
}: {
  block: Extract<Block, { type: 'confirmation_card' }>;
  onConfirm(): void;
  onEdit(): void;
  onCancel(): void;
  disabled?: boolean;
}) {
  const open = !block.state;
  return (
    <section className="ai-card" aria-label={block.title}>
      <h3 className="ai-card-title">{block.title}</h3>
      <ul className="ai-card-lines">
        {block.lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      {open ? (
        <div className="ai-actions">
          <button type="button" className="ai-btn ai-btn-primary" disabled={disabled} onClick={onConfirm}>
            {copy.blocks.confirm}
          </button>
          {block.action.kind === 'book-trip' && (
            <button type="button" className="ai-btn ai-btn-ghost" disabled={disabled} onClick={onEdit}>
              {copy.blocks.edit}
            </button>
          )}
          <button type="button" className="ai-btn ai-btn-ghost" disabled={disabled} onClick={onCancel}>
            {copy.blocks.cancel}
          </button>
        </div>
      ) : (
        <p className="ai-card-state">{block.state === 'done' ? copy.blocks.done : copy.blocks.cancelled}</p>
      )}
    </section>
  );
}

export function StepsCard({
  block,
  onChip,
  disabled,
}: {
  block: Extract<Block, { type: 'steps_card' }>;
  onChip: OnChip;
  disabled?: boolean;
}) {
  return (
    <section className="ai-card" aria-label={block.title}>
      <h3 className="ai-card-title">{block.title}</h3>
      <ol className="ai-steps">
        {block.steps.map((s, i) => (
          <li key={i}>
            <span className="ai-step-n">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div className="ai-actions">
        <button type="button" className="ai-btn ai-btn-primary" disabled={disabled} onClick={() => onChip(block.done)}>
          {block.done.label}
        </button>
        <button type="button" className="ai-btn ai-btn-ghost" disabled={disabled} onClick={() => onChip(block.call)}>
          {block.call.label}
        </button>
      </div>
    </section>
  );
}

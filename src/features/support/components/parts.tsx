import type { ReactNode } from 'react';
import { cx } from '@/utils/cx';
import type { Attachment, TicketMessage, TicketStatus } from '../types';
import { copy } from '../copy';

/** A big tap target: 44 px at least. */
export function Chip({
  children,
  onClick,
  disabled,
  tone = 'brand',
}: {
  children: ReactNode;
  onClick(): void;
  disabled?: boolean;
  tone?: 'brand' | 'plain';
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'min-h-11 cursor-pointer rounded-full border px-4 text-sm font-semibold outline-focus-ring transition focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'brand'
          ? 'border-brand bg-brand-primary text-brand-secondary hover:bg-brand-secondary'
          : 'border-primary bg-primary text-secondary hover:bg-primary_hover',
      )}
    >
      {children}
    </button>
  );
}
export const PRIMARY =
  'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-brand-solid px-4 text-sm font-semibold text-white outline-focus-ring transition hover:bg-brand-solid_hover focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50';
export const SECONDARY =
  'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-primary bg-primary px-4 text-sm font-semibold text-secondary outline-focus-ring transition hover:bg-primary_hover focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50';

const STATUS_STYLE: Record<TicketStatus, string> = {
  new: 'bg-brand-primary text-brand-secondary',
  open: 'bg-success-primary text-success-primary',
  pending: 'bg-warning-primary text-warning-primary',
  solved: 'bg-secondary text-tertiary',
};
export function StatusChip({ status }: { status: TicketStatus }) {
  return (
    <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_STYLE[status])}>
      {copy.tickets.statuses[status]}
    </span>
  );
}
export function AttachmentView({ a }: { a: Attachment }) {
  return a.dataUrl ? (
    <img src={a.dataUrl} alt={a.name} className="mt-1 max-h-32 rounded-lg border border-secondary object-cover" />
  ) : (
    <span className="mt-1 inline-block rounded-md bg-secondary px-2 py-1 text-xs text-secondary">{a.name}</span>
  );
}
/** One message of a conversation: yours on the right, the bot's, the agent's and system notes on the left. */
export function Bubble({ m }: { m: Pick<TicketMessage, 'from' | 'author' | 'text' | 'attachments'> }) {
  const mine = m.from === 'user';
  return (
    <div className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cx(
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]',
          mine
            ? 'rounded-br-sm bg-brand-solid text-white'
            : m.from === 'system'
              ? 'bg-secondary text-tertiary italic'
              : 'rounded-bl-sm bg-secondary text-primary',
        )}
      >
        {!mine && m.author && <p className="mb-0.5 text-xs font-semibold text-tertiary">{m.author}</p>}
        {m.text}
        {m.attachments?.map((a, i) => (
          <AttachmentView key={i} a={a} />
        ))}
      </div>
    </div>
  );
}
export function TypingDots({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex w-fit items-center gap-1 rounded-2xl bg-secondary px-3 py-3">
      {[0, 1, 2].map((i) => (
        <i
          key={i}
          className="sup-dot size-1.5 rounded-full bg-fg-quaternary"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { StatusDot } from '@/components/data/StatusDot';
import { timeAgo } from '@/utils/timeAgo';
import { copy } from '../copy';
import { supportStore, useSupport } from '../store';
import { PRIMARY, StatusChip } from './parts';

/** The person's tickets (and the ones saved while there was no internet): id, subject, status, when it last changed, and a dot for an unread reply. */
export function TicketList() {
  const tickets = useSupport((s) => s.tickets);
  const drafts = useSupport((s) => s.drafts);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    void supportStore.getState().refresh();
  }, []);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
        {drafts.map((d) => (
          <li key={d.id} className="rounded-xl border border-dashed border-primary p-3">
            <p className="text-sm font-semibold text-primary">{d.input.subject ?? d.input.description.slice(0, 60)}</p>
            <p className="text-xs text-warning-primary">{copy.tickets.willSend}</p>
          </li>
        ))}
        {tickets.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => supportStore.getState().go('ticket', { ticketId: t.id })}
              className="flex min-h-14 w-full cursor-pointer flex-col gap-1 rounded-xl border border-secondary bg-primary p-3 text-left outline-focus-ring hover:bg-primary_hover focus-visible:outline-2"
            >
              <span className="flex items-center gap-2">
                <span className="text-xs font-semibold text-tertiary">{t.id}</span>
                <StatusChip status={t.status} />
                {t.unread > 0 && (
                  <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-brand-secondary">
                    <StatusDot tone="brand" />
                    {copy.tickets.newReply}
                  </span>
                )}
              </span>
              <span className="text-sm font-semibold text-primary">{t.subject}</span>
              <span className="text-xs text-tertiary">{copy.tickets.updated(timeAgo(t.updatedAt, now))}</span>
            </button>
          </li>
        ))}
        {!tickets.length && !drafts.length && (
          <li className="py-8 text-center text-sm text-tertiary">{copy.tickets.empty}</li>
        )}
      </ul>
      <div className="border-t border-secondary p-3">
        <button
          type="button"
          className={`${PRIMARY} w-full`}
          onClick={() => supportStore.getState().go('new', { prefill: null })}
        >
          {copy.tickets.create}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { copy } from '../copy';
import { supportService, supportStore, useSupport } from '../store';
import type { TicketWithMessages } from '../types';
import { IncludedInfo } from './IncludedInfo';
import { SECONDARY, StatusChip } from './parts';
import { Thread } from './Thread';

/** One ticket: its status, "Included info", the conversation with a reply box, and Reopen when it is solved. */
export function TicketDetail() {
  const id = useSupport((s) => s.ticketId);
  const tickets = useSupport((s) => s.tickets);
  const [full, setFull] = useState<TicketWithMessages | null>(null);
  const status = tickets.find((t) => t.id === id)?.status ?? full?.status;
  useEffect(() => {
    if (id) void supportService.getTicket(id).then(setFull);
  }, [id, status]);
  if (!id) return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 border-b border-secondary p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-tertiary">{id}</span>
          {status && <StatusChip status={status} />}
        </div>
        <p className="text-sm font-semibold text-primary">{full?.subject}</p>
        {full && <IncludedInfo context={full.context} />}
        {status === 'solved' && (
          <button
            type="button"
            className={SECONDARY}
            onClick={async () => {
              await supportService.reopenTicket(id);
              await supportStore.getState().refresh();
            }}
          >
            {copy.tickets.reopen}
          </button>
        )}
      </div>
      <Thread ticketId={id} />
    </div>
  );
}

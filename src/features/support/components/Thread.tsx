import { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip, Send01 } from '@untitledui/icons';
import { copy } from '../copy';
import { internetUp, supportService, supportStore, useSupport } from '../store';
import type { Attachment, TicketWithMessages } from '../types';
import { AttachmentView, Bubble, PRIMARY, SECONDARY, TypingDots } from './parts';

const MAX_THUMB = 200_000;
/** An image small enough to keep as a thumbnail (the rest is shown by name). */
async function toAttachment(f: File): Promise<Attachment> {
  if (!f.type.startsWith('image/') || f.size > MAX_THUMB) return { name: f.name, type: f.type };
  const dataUrl = await new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.readAsDataURL(f);
  });
  return { name: f.name, type: f.type, dataUrl };
}

/**
 * A ticket's conversation: messages (announced politely to screen readers), the agent's typing dots, and a reply box with attachments. New agent replies arrive through the service's
 * events; while the thread is on screen they count as read.
 */
export function Thread({
  ticketId,
  onEnd,
  footer,
}: {
  ticketId: string;
  onEnd?: () => void;
  footer?: React.ReactNode;
}) {
  const [ticket, setTicket] = useState<TicketWithMessages | null>(null);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const net = useSupport((s) => internetUp(s));
  const load = useCallback(async () => {
    setTicket(await supportService.getTicket(ticketId));
    await supportService.markRead(ticketId);
  }, [ticketId]);
  useEffect(() => {
    let live = true;
    void supportService.getTicket(ticketId).then((t) => {
      if (!live) return;
      setTicket(t);
      void supportService.markRead(ticketId).then(() => supportStore.getState().refresh());
    });
    const off = supportService.subscribe((e) => {
      if (e.ticketId !== ticketId) return;
      if (e.type === 'typing') setTyping(e.on);
      else void load().then(() => supportStore.getState().refresh());
    });
    return () => {
      live = false;
      off();
    };
  }, [ticketId, load]);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [ticket?.messages.length, typing]);
  const send = async () => {
    const t = text.trim();
    if (!t && !files.length) return;
    setText('');
    const a = files;
    setFiles([]);
    await supportService.sendMessage(ticketId, { text: t, attachments: a });
    await load();
  };
  const solved = ticket?.status === 'solved';
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-3" role="log" aria-live="polite" aria-label={ticket?.subject}>
        <div className="flex flex-col gap-2">
          {ticket?.messages.map((m) => (
            <Bubble key={m.id} m={m} />
          ))}
          {typing && <TypingDots label={copy.chat.typing} />}
          {footer}
          <div ref={end} />
        </div>
      </div>
      {!solved && (
        <div className="border-t border-secondary p-3">
          {files.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <button
                  key={i}
                  type="button"
                  className="rounded-lg outline-focus-ring focus-visible:outline-2"
                  onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}
                  aria-label={f.name}
                >
                  <AttachmentView a={f} />
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <label className={`${SECONDARY} w-11 !px-0`} title={copy.chat.attach}>
              <Paperclip aria-hidden className="size-5" />
              <span className="sr-only">{copy.chat.attach}</span>
              <input
                type="file"
                className="sr-only"
                accept="image/*,.pdf,.txt,.log"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  const a = await toAttachment(f);
                  setFiles((x) => [...x, a]);
                }}
              />
            </label>
            <textarea
              rows={1}
              value={text}
              disabled={!net}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={copy.chat.placeholder}
              aria-label={copy.chat.placeholder}
              className="max-h-28 min-h-11 flex-1 resize-none rounded-lg border border-primary bg-primary px-3 py-2.5 text-sm text-primary outline-focus-ring placeholder:text-placeholder focus-visible:outline-2"
            />
            <button
              type="button"
              className={`${PRIMARY} w-11 !px-0`}
              disabled={!net || (!text.trim() && !files.length)}
              onClick={() => void send()}
              aria-label={copy.chat.send}
            >
              <Send01 aria-hidden className="size-5" />
            </button>
          </div>
          {onEnd && ticket?.agentJoined && (
            <button
              type="button"
              className="mt-2 min-h-11 text-sm font-semibold text-tertiary underline outline-focus-ring focus-visible:outline-2"
              onClick={onEnd}
            >
              {copy.chat.end}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

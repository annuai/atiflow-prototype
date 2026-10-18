import { services } from '@/services';
import { log } from '@/platform';
import { AGENT, AGENT_REPLIES, GREETING, OFFLINE_NOTE, SCRIPTED_REPLY, seedTickets } from '../data/mockSupportData';
import { SUPPORT_PHONE, backAtLabel, hoursLabel, isSupportOpen, nextOpenAt } from '../hours';
import type {
  CallbackInput,
  NewMessage,
  SupportEvent,
  SupportService,
  SupportStatus,
  Ticket,
  TicketInput,
  TicketMessage,
  TicketWithMessages,
} from '../types';

const KEY = 'support:db';
/** The ticket a callback request becomes (also what is saved as a draft when there is no internet). */
export function callbackTicket(input: CallbackInput): TicketInput {
  const when = {
    asap: 'as soon as possible',
    '30m': 'in 30 minutes',
    '1h': 'in 1 hour',
    reopen: 'when support reopens',
  }[input.when];
  return {
    category: 'question',
    severity: 'degraded',
    subject: 'Callback requested',
    description: `Please call me on ${input.phone} ${when}.`,
    context: input.context,
    tags: ['callback_requested'],
  };
}
interface Db {
  seq: number;
  tickets: (Ticket & { messages: TicketMessage[] })[];
  scripted: boolean;
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
let n = 0;
const mid = () => `m${Date.now().toString(36)}${n++}`;

export interface MockOptions {
  /** the dev toggle: true / false forces support online / offline, null follows the real clock */
  override?: () => boolean | null;
  now?: () => Date;
  /** pause lengths in ms (tests make them tiny) */
  speed?: number;
}

/**
 * The helpdesk with no backend: tickets and their conversations are kept in this browser, calls take 300-800 ms, and a simulated agent ("Priya") joins and answers when support is open.
 * PROD: every method below is one call to a thin backend of ours that talks to Zendesk with credentials the browser never sees (see each comment).
 */
export class MockSupportService implements SupportService {
  private db: Db;
  private handlers = new Set<(e: SupportEvent) => void>();
  private scriptedTimer: number | undefined;
  constructor(private readonly opts: MockOptions = {}) {
    this.db = this.load();
  }
  private get speed() {
    return this.opts.speed ?? 1;
  }
  private now = () => this.opts.now?.() ?? new Date();
  private load(): Db {
    try {
      const raw = services().device.get(KEY);
      if (raw) return JSON.parse(raw) as Db;
    } catch {
      log.child('support').warn('saved support data could not be read; starting from the examples');
    }
    const t = this.now().getTime();
    return { seq: 1042, scripted: false, tickets: seedTickets(t).map((s) => ({ ...s.ticket, messages: s.messages })) };
  }
  private save() {
    services().device.set(KEY, JSON.stringify(this.db));
  }
  private emit(e: SupportEvent) {
    this.handlers.forEach((h) => h(e));
  }
  private async latency() {
    await wait(rand(300, 800) * this.speed);
  }
  private find(id: string) {
    const t = this.db.tickets.find((x) => x.id === id);
    if (!t) throw new Error(`Ticket ${id} was not found`);
    return t;
  }
  private push(t: Db['tickets'][number], m: Omit<TicketMessage, 'id' | 'at'>, unread = false) {
    const message: TicketMessage = { ...m, id: mid(), at: Date.now() };
    t.messages.push(message);
    t.updatedAt = message.at;
    if (unread) t.unread += 1;
    this.save();
    this.emit({ type: 'message', ticketId: t.id, message });
  }
  private online() {
    const o = this.opts.override?.();
    return o ?? isSupportOpen(this.now());
  }
  /** PROD: computed from the helpdesk's business hours (Zendesk schedule) by the backend. */
  getSupportStatus(): SupportStatus {
    return { online: this.online(), nextOpenAt: nextOpenAt(this.now()), hoursLabel: hoursLabel() };
  }
  /** The simulated agent joins after 3-6 s (typing first), greets, and the ticket becomes Open. PROD: Zendesk Messaging hands the chat to a real agent; webhooks send the events. */
  private joinAgent(id: string, name: string) {
    window.setTimeout(
      () => {
        const t = this.db.tickets.find((x) => x.id === id);
        if (!t || t.status === 'solved') return;
        this.emit({ type: 'typing', ticketId: id, on: true });
        window.setTimeout(
          () => {
            this.emit({ type: 'typing', ticketId: id, on: false });
            t.agentJoined = true;
            t.status = 'open';
            this.push(t, { from: 'agent', author: AGENT, text: GREETING(name, id) }, true);
            this.emit({ type: 'status', ticketId: id, status: 'open' });
          },
          rand(1200, 2000) * this.speed,
        );
      },
      rand(3000, 6000) * this.speed,
    );
  }
  /** PROD: POST /api/v2/tickets (Zendesk Tickets API) with custom fields: site, robot ID, trip ID, firmware, severity, ATI Flow version and a deep link back to the page. */
  async createTicket(input: TicketInput): Promise<Ticket> {
    await this.latency();
    const id = `ATI-${++this.db.seq}`;
    const now = Date.now();
    const subject = input.subject?.trim() || input.description.trim().split('\n')[0].slice(0, 80) || 'Support request';
    const t: Db['tickets'][number] = {
      id,
      subject,
      category: input.category,
      severity: input.severity,
      status: 'new',
      createdAt: now,
      updatedAt: now,
      unread: 0,
      robotId: input.robotId,
      tripId: input.tripId,
      tags: input.tags ?? [],
      context: input.context,
      messages: [...(input.transcript ?? [])],
    };
    this.db.tickets.unshift(t);
    this.push(t, { from: 'user', text: input.description, attachments: input.attachments });
    if (this.online()) this.joinAgent(id, input.context.user.name.split(' ')[0]);
    else
      this.push(t, {
        from: 'bot',
        text: OFFLINE_NOTE(id, backAtLabel(nextOpenAt(this.now())), SUPPORT_PHONE),
      });
    return this.strip(t);
  }
  private strip(t: Db['tickets'][number]): Ticket {
    const { messages: _m, ...ticket } = t;
    return structuredClone(ticket);
  }
  /** PROD: GET /api/v2/requests (the signed-in customer's own tickets, scoped by the backend). */
  async listTickets(): Promise<Ticket[]> {
    await this.latency();
    return [...this.db.tickets].sort((a, b) => b.updatedAt - a.updatedAt).map((t) => this.strip(t));
  }
  /** PROD: GET /api/v2/requests/{id}/comments. */
  async getTicket(id: string): Promise<TicketWithMessages> {
    await wait(rand(150, 300) * this.speed);
    const t = this.find(id);
    return structuredClone(t);
  }
  /** PROD: a public comment on the ticket (Zendesk Messaging while a chat is live); the agent's answer comes back by webhook. */
  async sendMessage(ticketId: string, msg: NewMessage): Promise<void> {
    await wait(rand(150, 400) * this.speed);
    const t = this.find(ticketId);
    this.push(t, { from: 'user', text: msg.text, attachments: msg.attachments });
    if (t.status === 'solved') return;
    if (t.agentJoined && this.online()) {
      const replies = AGENT_REPLIES[t.category];
      const turn = t.messages.filter((m) => m.from === 'agent').length - 1; // the greeting is the first agent message
      window.setTimeout(
        () => {
          this.emit({ type: 'typing', ticketId, on: true });
          window.setTimeout(
            () => {
              this.emit({ type: 'typing', ticketId, on: false });
              this.push(t, { from: 'agent', author: AGENT, text: replies[Math.max(0, turn) % replies.length] }, true);
            },
            rand(1500, 2500) * this.speed,
          );
        },
        rand(600, 1200) * this.speed,
      );
    }
  }
  /** PROD: a ticket tagged `callback_requested` with the phone number and the preferred time as custom fields; support calls back. */
  async requestCallback(input: CallbackInput): Promise<Ticket> {
    return this.createTicket(callbackTicket(input));
  }
  /** PROD: a satisfaction rating on the Zendesk ticket (CSAT). */
  async submitCsat(ticketId: string, score: 'up' | 'down', comment?: string): Promise<void> {
    await this.latency();
    const t = this.find(ticketId);
    t.csat = { score, comment };
    this.save();
  }
  /** PROD: kept in our own backend (read receipts are not a Zendesk concept). */
  async markRead(ticketId: string): Promise<void> {
    const t = this.find(ticketId);
    if (t.unread) {
      t.unread = 0;
      this.save();
    }
  }
  /** PROD: update the Zendesk ticket status to open. */
  async reopenTicket(ticketId: string): Promise<void> {
    await this.latency();
    const t = this.find(ticketId);
    t.status = 'open';
    t.updatedAt = Date.now();
    this.push(t, { from: 'system', text: 'You reopened this ticket.' });
    this.emit({ type: 'status', ticketId, status: 'open' });
  }
  /** The scripted agent reply is always scheduled, and delivered only while support is online (outside the hours no agent writes: it waits and tries again), whatever the time the page opened at. */
  private armScriptedReply(after: number) {
    this.scriptedTimer = window.setTimeout(() => {
      if (!this.online()) return this.armScriptedReply(5000 * this.speed);
      const t = this.db.tickets.find((x) => x.id === SCRIPTED_REPLY.ticketId);
      this.db.scripted = true;
      if (t) this.push(t, { from: 'agent', author: AGENT, text: SCRIPTED_REPLY.text }, true);
      else this.save();
    }, after);
  }
  /** PROD: a server-sent stream fed by Zendesk webhooks (agent replies, status changes). */
  subscribe(handler: (e: SupportEvent) => void): () => void {
    this.handlers.add(handler);
    if (!this.db.scripted && this.scriptedTimer === undefined)
      this.armScriptedReply(SCRIPTED_REPLY.afterMs * this.speed);
    return () => this.handlers.delete(handler);
  }
}

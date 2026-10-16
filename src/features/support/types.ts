export type Category = 'robot' | 'trip' | 'login' | 'bug' | 'question';
export type Severity = 'blocking' | 'degraded' | 'question';
export type TicketStatus = 'new' | 'open' | 'pending' | 'solved';
export interface Attachment {
  name: string;
  type: string;
  /** small images only (kept so the thumbnail survives a reload) */ dataUrl?: string;
}
export interface TicketMessage {
  id: string;
  from: 'user' | 'agent' | 'bot' | 'system';
  author?: string;
  text: string;
  at: number;
  attachments?: Attachment[];
}
/** What is sent along with every ticket and shown to the person, transparently, in "Included info". */
export interface SupportContext {
  user: { name: string; username: string; role: string };
  site: string;
  account: string;
  route: string;
  robotId?: string;
  tripId?: string;
  alerts: string[];
  atiFlowVersion: string;
  firmwareVersion: string;
  device: string;
  /** a short summary of a conversation with Ati AI, only when the person chose to send it */ aiSummary?: string;
}
export interface Ticket {
  id: string;
  subject: string;
  category: Category;
  severity: Severity;
  status: TicketStatus;
  createdAt: number;
  updatedAt: number;
  /** agent replies the person has not seen */ unread: number;
  robotId?: string;
  tripId?: string;
  tags: string[];
  context: SupportContext;
  csat?: { score: 'up' | 'down'; comment?: string };
  /** an agent has joined the conversation */ agentJoined?: boolean;
}
export interface TicketWithMessages extends Ticket {
  messages: TicketMessage[];
}
export interface TicketInput {
  category: Category;
  severity: Severity;
  subject?: string;
  description: string;
  robotId?: string;
  tripId?: string;
  attachments?: Attachment[];
  context: SupportContext;
  tags?: string[];
  /** what the bot and the person already went through (kept as the first messages) */ transcript?: TicketMessage[];
}
export interface NewMessage {
  text: string;
  attachments?: Attachment[];
}
export interface CallbackInput {
  phone: string;
  when: 'asap' | '30m' | '1h' | 'reopen';
  context: SupportContext;
}
export type SupportEvent =
  | { type: 'message'; ticketId: string; message: TicketMessage }
  | { type: 'status'; ticketId: string; status: TicketStatus }
  | { type: 'typing'; ticketId: string; on: boolean };
export interface SupportStatus {
  online: boolean;
  nextOpenAt: Date;
  hoursLabel: string;
}
/** The one seam to the real helpdesk: replace `MockSupportService` (Zendesk behind a backend proxy) and nothing else changes. */
export interface SupportService {
  getSupportStatus(): SupportStatus;
  createTicket(input: TicketInput): Promise<Ticket>;
  listTickets(): Promise<Ticket[]>;
  getTicket(id: string): Promise<TicketWithMessages>;
  sendMessage(ticketId: string, msg: NewMessage): Promise<void>;
  requestCallback(input: CallbackInput): Promise<Ticket>;
  submitCsat(ticketId: string, score: 'up' | 'down', comment?: string): Promise<void>;
  /** the person has read the ticket (clears its unread count) */ markRead(ticketId: string): Promise<void>;
  reopenTicket(ticketId: string): Promise<void>;
  subscribe(handler: (event: SupportEvent) => void): () => void;
}

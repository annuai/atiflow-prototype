import type { WorkspaceId } from '@/features/access';

/** The three assistants: one per workspace the person holds (the same ids as the workspaces). */
export type Role = WorkspaceId;
export type Range = 'today' | '7d' | '30d';

/** A tap target the assistant offers: sending it back as `actionId` (+ `payload`) is the same as typing the text. */
export interface Chip {
  id: string;
  label: string;
  payload?: Record<string, string>;
}

export interface WorkflowStep {
  id: string;
  kind: 'trigger' | 'action' | 'wait' | 'condition' | 'error';
  text: string;
  /** a condition that belongs to the step with this id */
  for?: string;
}
export interface WorkflowDraft {
  name: string;
  steps: WorkflowStep[];
  /** the draft was saved as a draft (never published from the assistant) */
  saved?: boolean;
}
export interface ValidationItem {
  id: string;
  level: 'warn' | 'error';
  text: string;
  /** the id of the fix; the person confirms it before the draft changes */
  fix?: string;
  fixLabel?: string;
}
export interface BookingDraft {
  from?: string;
  to?: string;
  priority?: 'normal' | 'high' | 'urgent';
}

/** What changes the person's state: always shown on a confirmation card first, never done silently. */
export type PendingAction =
  | {
      kind: 'book-trip';
      from: string;
      to: string;
      fromName: string;
      toName: string;
      robotType: string;
      robotLabel: string;
      priority: 'normal' | 'high' | 'urgent';
    }
  | { kind: 'cancel-trip'; bookingId: string; tripId: string }
  | { kind: 'call-supervisor' }
  | { kind: 'workflow-fix'; fix: string }
  | { kind: 'workflow-wait'; seconds: number; beforeStep: number }
  | { kind: 'workflow-save' };

/** The structured pieces a reply is made of: a real model can return the same schema later. */
export type Block =
  | { type: 'text'; text: string }
  | { type: 'chips'; chips: Chip[] }
  | {
      type: 'confirmation_card';
      id: string;
      title: string;
      lines: string[];
      action: PendingAction;
      state?: 'done' | 'cancelled';
    }
  | { type: 'steps_card'; title: string; steps: string[]; done: Chip; call: Chip }
  | { type: 'chart'; kind: 'bar' | 'line'; title: string; unit?: string; points: { label: string; value: number }[] }
  | { type: 'table'; title: string; columns: string[]; rows: string[][] }
  | { type: 'kpi_tiles'; tiles: { label: string; value: string; delta?: string; good?: boolean }[] }
  | { type: 'workflow_preview'; workflow: WorkflowDraft; highlight?: string[]; title?: string }
  | { type: 'validation_list'; items: ValidationItem[] }
  | { type: 'actions'; actions: Chip[] };

export interface AiMessage {
  id: string;
  from: 'user' | 'ai';
  blocks: Block[];
  at: number;
}

/** Things a reply may change in the assistant's own memory (not the app). */
export interface Patch {
  booking?: BookingDraft | null;
  workflow?: WorkflowDraft | null;
}
export type AiEvent = { type: 'block'; block: Block } | { type: 'patch'; patch: Patch };

export interface TripView {
  bookingId: string;
  tripId: string;
  status: string;
  statusLabel: string;
  cancellable: boolean;
  from: string;
  to: string;
  fromName: string;
  toName: string;
  robotId?: string;
  robotLabel: string;
  at: number;
}
export interface RobotView {
  id: string;
  model: string;
  label: string;
  battery: number;
  state: string;
  /** what it is doing now, in plain words (heading to a station, waiting for another robot...) */
  doing: string;
  free: boolean;
}
/** Everything the assistant may know about the app at the moment of a message (built by `useAiContext`). */
export interface Context {
  user: { username: string; name: string };
  fleet: { id: string; name: string } | null;
  stations: { id: string; name: string }[];
  robots: RobotView[];
  trips: TripView[];
  range: Range;
  booking: BookingDraft | null;
  workflow: WorkflowDraft | null;
  now: number;
  /** the only way the assistant changes the app: called after the person confirmed */
  actions: {
    bookTrip(a: Extract<PendingAction, { kind: 'book-trip' }>): { tripId: string; bookingId: string } | null;
    cancelTrip(bookingId: string): boolean;
    callSupervisor(): void;
  };
}
export interface AtiAiInput {
  role: Role;
  text?: string;
  actionId?: string;
  payload?: Record<string, string>;
  context: Context;
}
/** The one seam to a real backend: replace `MockAtiAiService` and nothing else changes. */
export interface AtiAiService {
  sendMessage(input: AtiAiInput): AsyncIterable<AiEvent>;
}

import type { AiEvent, AtiAiInput, AtiAiService, Block, Context, PendingAction, WorkflowDraft } from '../types';
import { chip, chips, text, type Reply } from './blocks';
import { addWait, applyAll, applyFix, configuratorReply, validate } from './configurator';
import { operatorReply } from './operator';
import { supervisorReply } from './supervisor';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const etaMin = (c: Context) => 3 + c.trips.filter((t) => ['approved', 'ongoing'].includes(t.status)).length * 2;

/** What a CONFIRMED action does: the only place the assistant changes anything, and only after the person pressed Confirm on its card. */
function execute(a: PendingAction, c: Context): Reply {
  switch (a.kind) {
    case 'book-trip': {
      const r = c.actions.bookTrip(a);
      return r
        ? {
            blocks: [
              text(
                `Done. Trip ${r.tripId} is booked: ${a.fromName} to ${a.toName}. A robot should reach ${a.fromName} in about ${etaMin(c)} minutes.`,
              ),
              chips([chip('where', 'Where is my robot?'), chip('book:start', 'Book another trip')]),
            ],
            patch: { booking: null },
          }
        : {
            blocks: [text('Sorry, I could not book that trip. Please try again or use the Book trip page.')],
            patch: { booking: null },
          };
    }
    case 'cancel-trip':
      return c.actions.cancelTrip(a.bookingId)
        ? { blocks: [text(`Trip ${a.tripId} is cancelled.`)] }
        : { blocks: [text(`Trip ${a.tripId} can no longer be cancelled: a robot is already on its way.`)] };
    case 'call-supervisor':
      c.actions.callSupervisor();
      return { blocks: [text('Your supervisor has been called. Stay near the robot.')] };
    case 'workflow-fix': {
      const w = c.workflow;
      if (!w) return { blocks: [text('There is no draft to change.')] };
      const next: WorkflowDraft = a.fix === 'all' ? applyAll(w) : applyFix(w, a.fix);
      const before = new Set(w.steps.map((s) => s.id));
      return {
        blocks: [
          text(
            a.fix === 'all'
              ? 'Applied every suggested fix to the draft. The new parts are highlighted.'
              : 'Applied the fix to the draft. The new part is highlighted.',
          ),
          {
            type: 'workflow_preview',
            workflow: next,
            highlight: next.steps
              .filter((s) => !before.has(s.id) || s.text !== w.steps.find((x) => x.id === s.id)?.text)
              .map((s) => s.id),
          },
          ...(validate(next).length
            ? ([{ type: 'validation_list', items: validate(next) }] as Block[])
            : [text('Every check passes now.')]),
        ],
        patch: { workflow: next },
      };
    }
    case 'workflow-wait': {
      const w = c.workflow;
      if (!w) return { blocks: [text('There is no draft to change.')] };
      const next = addWait(w, a.seconds, a.beforeStep);
      const before = new Set(w.steps.map((s) => s.id));
      return {
        blocks: [
          text(`Added a ${a.seconds} s wait before step ${a.beforeStep}.`),
          {
            type: 'workflow_preview',
            workflow: next,
            highlight: next.steps.filter((s) => !before.has(s.id)).map((s) => s.id),
          },
        ],
        patch: { workflow: next },
      };
    }
    case 'workflow-save':
      return c.workflow
        ? {
            blocks: [text(`"${c.workflow.name}" is saved as a draft. It is not published.`)],
            patch: { workflow: { ...c.workflow, saved: true } },
          }
        : { blocks: [text('There is no draft to save.')] };
  }
}

function reply(i: AtiAiInput): Reply {
  if (i.actionId === 'confirm' && i.payload?.action)
    return execute(JSON.parse(i.payload.action) as PendingAction, i.context);
  if (i.actionId === 'dismiss') return { blocks: [text('Okay, nothing was changed.')] };
  if (i.actionId === 'edit')
    return i.role === 'operator'
      ? operatorReply({ ...i, actionId: 'book:start' })
      : { blocks: [text('Tell me what to change.')] };
  return i.role === 'operator' ? operatorReply(i) : i.role === 'supervisor' ? supervisorReply(i) : configuratorReply(i);
}

/** The assistant with no backend: keyword and regex intent matching over canned, structured answers, a short think time, and reads of the app's own live state. */
export class MockAtiAiService implements AtiAiService {
  constructor(private readonly latency: [number, number] = [400, 900]) {}
  async *sendMessage(input: AtiAiInput): AsyncIterable<AiEvent> {
    await wait(this.latency[0] + Math.random() * (this.latency[1] - this.latency[0]));
    const r = reply(input);
    if (r.patch) yield { type: 'patch', patch: r.patch };
    for (const block of r.blocks) yield { type: 'block', block };
  }
}

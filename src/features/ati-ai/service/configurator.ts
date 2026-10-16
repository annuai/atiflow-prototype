import { SAMPLE_WORKFLOW, SAMPLE_WORKFLOW_LAST_WEEK } from '../data/mockData';
import type { AtiAiInput, Block, Chip, ValidationItem, WorkflowDraft, WorkflowStep } from '../types';
import { actions, chip, chips, confirm, has, text, type Reply } from './blocks';

let seq = 0;
const step = (kind: WorkflowStep['kind'], t: string, forStep?: string): WorkflowStep => ({
  id: `n${Date.now().toString(36)}${seq++}`,
  kind,
  text: t,
  ...(forStep ? { for: forStep } : {}),
});
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Turns a plain description into steps: "When a cart arrives at Station A, wait for operator confirm, then go to Station B". Clauses are split on commas and "then"; each is classified by its verb. */
export function parseWorkflow(description: string, name = 'New workflow'): WorkflowDraft {
  const clauses = description
    .replace(/\.$/, '')
    .split(/,|\bthen\b|\band then\b|\bafter that\b|;/i)
    .map((c) => c.trim())
    .filter(Boolean);
  const steps = clauses.map((c, i): WorkflowStep => {
    const l = c.toLowerCase();
    if (/^(when|if|once|as soon as|on)\b/.test(l) && i === 0)
      return step('trigger', cap(c.replace(/^(when|once|as soon as|if|on)\s+/i, '')));
    if (/\b(wait|confirm|pause|hold)\b/.test(l)) return step('wait', cap(c));
    if (/\b(error|fails?|stuck|retry|alert)\b/.test(l)) return step('error', cap(c));
    return step('action', cap(c));
  });
  if (steps.length && steps[0].kind !== 'trigger') steps.unshift(step('trigger', 'The workflow is started'));
  return { name, steps };
}
export function validate(w: WorkflowDraft): ValidationItem[] {
  const out: ValidationItem[] = [];
  const waits = w.steps.filter((s) => s.kind === 'wait');
  waits.forEach((s) => {
    if (!/timeout|\b\d+\s*s\b|seconds?|minutes?/.test(s.text.toLowerCase()))
      out.push({
        id: `to-${s.id}`,
        level: 'warn',
        text: `No timeout on step ${w.steps.indexOf(s) + 1} ("${s.text}"): a robot could wait for ever.`,
        fix: `timeout:${s.id}`,
        fixLabel: 'Add a 60 s timeout',
      });
  });
  const moves = w.steps.filter(
    (s) => s.kind === 'action' && /\b(go|move|deliver|bring|drive|send|take)\b.*\b(to|at)\b/i.test(s.text),
  );
  moves.forEach((s) => {
    if (!w.steps.some((x) => x.kind === 'condition' && x.for === s.id))
      out.push({
        id: `busy-${s.id}`,
        level: 'warn',
        text: `Step ${w.steps.indexOf(s) + 1}: the destination has no busy handling (what if it is occupied?).`,
        fix: `busy:${s.id}`,
        fixLabel: 'Wait up to 30 s if busy',
      });
  });
  if (!w.steps.some((s) => s.kind === 'error'))
    out.push({
      id: 'err',
      level: 'error',
      text: 'No error handling: nothing happens if the robot gets stuck.',
      fix: 'error',
      fixLabel: 'Add error handling',
    });
  return out;
}
export function applyFix(w: WorkflowDraft, fix: string): WorkflowDraft {
  const [kind, id] = fix.split(':');
  const steps = [...w.steps];
  const at = steps.findIndex((s) => s.id === id);
  if (kind === 'timeout' && at >= 0) steps[at] = { ...steps[at], text: `${steps[at].text} (timeout 60 s)` };
  if (kind === 'busy' && at >= 0)
    steps.splice(at, 0, step('condition', 'If the destination is busy, wait up to 30 s', steps[at].id));
  if (kind === 'error') steps.push(step('error', 'If the robot is stuck for 2 minutes, alert the supervisor'));
  return { ...w, steps };
}
export const applyAll = (w: WorkflowDraft) => validate(w).reduce((acc, v) => (v.fix ? applyFix(acc, v.fix) : acc), w);
export const addWait = (w: WorkflowDraft, seconds: number, before: number): WorkflowDraft => {
  const steps = [...w.steps];
  steps.splice(Math.max(0, Math.min(steps.length, before - 1)), 0, step('wait', `Wait ${seconds} s`));
  return { ...w, steps };
};
const names = (w: WorkflowDraft) => new Set(w.steps.map((s) => s.text));
function diff(a: WorkflowDraft, b: WorkflowDraft): string[] {
  const before = names(a);
  const now = names(b);
  return [
    ...b.steps.filter((s) => !before.has(s.text)).map((s) => `Added: ${s.text}`),
    ...a.steps.filter((s) => !now.has(s.text)).map((s) => `Removed: ${s.text}`),
  ];
}
const previewOf = (w: WorkflowDraft, highlight: string[] = [], title?: string): Block => ({
  type: 'workflow_preview',
  workflow: w,
  highlight,
  title,
});
const draftActions = (): Block =>
  actions([
    chip('wf:editor', 'Open in editor'),
    chip('wf:fixall', 'Apply suggested fixes'),
    chip('wf:save', 'Save as draft'),
  ]);

function validation(w: WorkflowDraft): Block[] {
  const items = validate(w);
  return items.length
    ? [
        text(`I found ${items.length} thing${items.length === 1 ? '' : 's'} to improve:`),
        { type: 'validation_list', items },
      ]
    : [text('This workflow looks good: every wait has a timeout and errors are handled.')];
}

/** A tapped chip or button (it carries its own `actionId`). */
function byAction(i: AtiAiInput): Reply | null {
  const p = i.payload ?? {};
  const w = i.context.workflow;
  switch (i.actionId) {
    case 'wf:create':
      return {
        blocks: [
          text(
            'Describe it in your own words, for example: "When a cart arrives at Station A, wait for operator confirm, then go to Station B".',
          ),
        ],
      };
    case 'wf:validate': {
      const target = w ?? SAMPLE_WORKFLOW;
      return {
        blocks: [
          text(
            w ? 'Checking your draft:' : 'You have no draft yet, so I checked the sample workflow "Kitting to Line 2":',
          ),
          previewOf(target),
          ...validation(target),
        ],
        patch: w ? undefined : { workflow: SAMPLE_WORKFLOW },
      };
    }
    case 'wf:errors': {
      const target = w ?? SAMPLE_WORKFLOW;
      return {
        blocks: [
          confirm('Add error handling?', ['Adds: "If the robot is stuck for 2 minutes, alert the supervisor"'], {
            kind: 'workflow-fix',
            fix: 'error',
          }),
        ],
        patch: w ? undefined : { workflow: target },
      };
    }
    case 'wf:explain': {
      const target = w ?? SAMPLE_WORKFLOW;
      return {
        blocks: [
          text(
            `"${target.name}" has ${target.steps.length} steps. ${target.steps.map((s, n) => `${n + 1}. ${s.text}.`).join(' ')} Nothing in it is published unless you do that in the editor.`,
          ),
          previewOf(target),
        ],
        patch: w ? undefined : { workflow: SAMPLE_WORKFLOW },
      };
    }
    case 'wf:changes': {
      const lines = diff(SAMPLE_WORKFLOW_LAST_WEEK, SAMPLE_WORKFLOW);
      return {
        blocks: [
          text('Since last week "Kitting to Line 2" changed in 2 places:'),
          text(lines.map((l) => `• ${l}`).join('\n')),
          previewOf(
            SAMPLE_WORKFLOW,
            SAMPLE_WORKFLOW.steps.filter((s) => !names(SAMPLE_WORKFLOW_LAST_WEEK).has(s.text)).map((s) => s.id),
          ),
        ],
      };
    }
    case 'wf:editor':
      return { blocks: [text('Opening the workflow editor. (Prototype: the draft is not copied there yet.)')] };
    case 'wf:fixall': {
      if (!w) return { blocks: [text('There is no draft to fix yet. Describe a workflow first.')] };
      const items = validate(w);
      return items.length
        ? {
            blocks: [
              confirm(
                `Apply ${items.length} suggested fix${items.length === 1 ? '' : 'es'}?`,
                items.map((v) => v.fixLabel ?? v.text),
                { kind: 'workflow-fix', fix: 'all' },
              ),
            ],
          }
        : { blocks: [text('Nothing to fix: the draft passes every check.')] };
    }
    case 'wf:fix': {
      const item = w && validate(w).find((v) => v.fix === p.fix);
      return item
        ? { blocks: [confirm(item.fixLabel ?? 'Apply this fix?', [item.text], { kind: 'workflow-fix', fix: p.fix })] }
        : { blocks: [text('That fix is not needed any more.')] };
    }
    case 'wf:save':
      return w
        ? {
            blocks: [
              confirm('Save as draft?', [`"${w.name}" is saved as a draft. It is not published.`], {
                kind: 'workflow-save',
              }),
            ],
          }
        : { blocks: [text('There is no draft to save yet.')] };
    default:
      return null;
  }
}

/** Workflow help: plain language to a draft with preview and checks, explanations, diffs and edits. Nothing is published, and every change to the draft is confirmed first. */
export function configuratorReply(i: AtiAiInput): Reply {
  const tapped = byAction(i);
  if (tapped) return tapped;
  const t = i.text ?? '';
  const w = i.context.workflow;
  const wait = t.match(/add (?:a )?(\d+)\s*s(?:ec(?:ond)?s?)? wait before step (\d+)/i);
  if (wait) {
    const target = w ?? SAMPLE_WORKFLOW;
    const sec = Number(wait[1]);
    const at = Number(wait[2]);
    const preview = addWait(target, sec, at);
    return {
      blocks: [
        confirm(`Add a ${sec} s wait before step ${at}?`, diff(target, preview), {
          kind: 'workflow-wait',
          seconds: sec,
          beforeStep: at,
        }),
        previewOf(
          preview,
          preview.steps.filter((s) => !names(target).has(s.text)).map((s) => s.id),
          'Preview of the change',
        ),
      ],
      patch: w ? undefined : { workflow: SAMPLE_WORKFLOW },
    };
  }
  if (has(t, /explain/)) return configuratorReply({ ...i, actionId: 'wf:explain' });
  if (has(t, /(what|how).*(change|differ)|since last week|diff/))
    return configuratorReply({ ...i, actionId: 'wf:changes' });
  if (has(t, /validate|check|review|problem/)) return configuratorReply({ ...i, actionId: 'wf:validate' });
  if (has(t, /error handling|error|retry|stuck/)) return configuratorReply({ ...i, actionId: 'wf:errors' });
  if (has(t, /\b(when|if|once|then|wait|go to|move|deliver|workflow|create)\b/) && t.trim().split(/\s+/).length > 3) {
    const draft = parseWorkflow(t);
    if (draft.steps.length < 2)
      return {
        blocks: [text('I need a bit more: what starts it, and what should the robot do?'), chips(defaultChips())],
      };
    return {
      blocks: [
        text(
          `I understood ${draft.steps.length} steps: ${draft.steps.map((s) => s.kind).join(', then ')}. This is a draft: nothing is published.`,
        ),
        previewOf(draft),
        ...validation(draft),
        draftActions(),
      ],
      patch: { workflow: draft },
    };
  }
  return {
    blocks: [
      text('I can create a workflow from a description, check one, or add error handling. Try one of these:'),
      chips(defaultChips()),
    ],
  };
}
const defaultChips = (): Chip[] => [
  chip('wf:create', 'Create a workflow'),
  chip('wf:validate', 'Validate my workflow'),
  chip('wf:errors', 'Add error handling'),
];

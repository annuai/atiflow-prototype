import { robotTypeById } from '@/data/robotTypes';
import type { AtiAiInput, BookingDraft, Context, PendingAction, TripView } from '../types';
import { chip, chips, confirm, has, text, type Reply } from './blocks';
import { findInSentence, type Named } from './fuzzy';

const PRIORITY = { normal: 'Normal', high: 'High', urgent: 'Urgent' } as const;
const nameOf = (c: Context, id: string) => c.stations.find((s) => s.id === id)?.name ?? id;
const ACTIVE = new Set(['approved', 'ongoing', 'pending']);

/** The places the person used most recently (their last trips), then the rest of the fleet's stations, as chips. */
function stationChips(c: Context, prefix: 'pick' | 'drop', skip?: string) {
  const recent = [...new Set(c.trips.flatMap((t) => (prefix === 'pick' ? [t.from] : [t.to])))];
  const ordered = [...recent, ...c.stations.map((s) => s.id).filter((id) => !recent.includes(id))].filter(
    (id) => id !== skip && c.stations.some((s) => s.id === id),
  );
  return ordered.slice(0, 6).map((id) => chip(prefix, nameOf(c, id), { id }));
}
function robotFor(c: Context) {
  const free = c.robots.find((r) => r.free);
  const any = free ?? c.robots[0];
  return { robot: any, free: !!free };
}
function bookingCard(c: Context, from: string, to: string, priority: BookingDraft['priority'] = 'normal'): Reply {
  const { robot, free } = robotFor(c);
  if (!robot)
    return {
      blocks: [text('There is no robot on your fleet right now, so I cannot send one. Please call your supervisor.')],
      patch: { booking: null },
    };
  const type = robotTypeById(robot.model);
  const action: PendingAction = {
    kind: 'book-trip',
    from,
    to,
    fromName: nameOf(c, from),
    toName: nameOf(c, to),
    robotType: type.id,
    robotLabel: type.label,
    priority,
  };
  return {
    blocks: [
      confirm(
        `Send ${robot.id} from ${action.fromName} to ${action.toName}?`,
        [
          `Robot: ${type.label}${free ? ` (${robot.id} is free now)` : ''}`,
          `Priority: ${PRIORITY[priority]}`,
          free ? 'It leaves right away.' : 'No robot is free right now, so the trip waits for the first one.',
        ],
        action,
      ),
    ],
    patch: { booking: null },
  };
}
const lastTrip = (c: Context): TripView | undefined => c.trips[0];

function where(c: Context): Reply {
  const t = c.trips.find((x) => ACTIVE.has(x.status)) ?? lastTrip(c);
  if (!t) return { blocks: [text('You have no trips yet.'), chips([chip('book:start', 'Book a trip')])] };
  const robot = t.robotId ? c.robots.find((r) => r.id === t.robotId) : undefined;
  if (t.status === 'approved')
    return { blocks: [text(`Trip ${t.tripId} is waiting for a free robot to take it, ${t.fromName} to ${t.toName}.`)] };
  if (t.status === 'ongoing' && robot)
    return {
      blocks: [
        text(
          `${robot.id} is ${robot.doing}. Trip ${t.tripId}: ${t.fromName} to ${t.toName}. Battery ${Math.round(robot.battery)}%.`,
        ),
      ],
    };
  return {
    blocks: [
      text(`Trip ${t.tripId} (${t.fromName} to ${t.toName}) is ${t.statusLabel.toLowerCase()}.`),
      chips([chip('repeat', 'Repeat last trip')]),
    ],
  };
}
function delayed(c: Context): Reply {
  const t = c.trips.find((x) => ACTIVE.has(x.status));
  if (!t) return { blocks: [text('You have no trip running, so nothing is late.')] };
  if (t.status === 'approved') {
    const busy = c.robots.filter((r) => !r.free).length;
    return {
      blocks: [
        text(
          `Trip ${t.tripId} is waiting because no robot is free yet (${busy} of ${c.robots.length} are busy or charging). It leaves as soon as one is.`,
        ),
        chips([chip('supervisor', 'Call supervisor')]),
      ],
    };
  }
  const robot = t.robotId ? c.robots.find((r) => r.id === t.robotId) : undefined;
  return {
    blocks: [
      text(
        robot
          ? `${robot.id} is ${robot.doing}. Other robots on the same road can slow it down for a moment.`
          : `Trip ${t.tripId} is on its way.`,
      ),
    ],
  };
}
function stuck(): Reply {
  return {
    blocks: [
      text('Sorry about that. Please try these steps:'),
      {
        type: 'steps_card',
        title: 'Robot is stuck',
        steps: [
          'Stay clear of the robot and check nothing is in front of it.',
          'Remove anything blocking its path.',
          'Press the green button on the robot once.',
          'Wait 30 seconds. If it does not move, call your supervisor.',
        ],
        done: chip('stuck:done', 'I did this'),
        call: chip('supervisor', 'Call supervisor'),
      },
    ],
  };
}

/** A tapped chip or button (it carries its own `actionId`). */
function byAction(i: AtiAiInput): Reply | null {
  const c = i.context;
  const p = i.payload ?? {};
  const draft = c.booking ?? {};
  switch (i.actionId) {
    case 'book:start':
      return {
        blocks: [text('Where should the robot pick up?'), chips(stationChips(c, 'pick'))],
        patch: { booking: {} },
      };
    case 'pick':
      return {
        blocks: [text(`Pick up at ${nameOf(c, p.id)}. Where should it go?`), chips(stationChips(c, 'drop', p.id))],
        patch: { booking: { ...draft, from: p.id } },
      };
    case 'drop':
      return {
        blocks: [
          text(`Going to ${nameOf(c, p.id)}. How urgent is it?`),
          chips((['normal', 'high', 'urgent'] as const).map((k) => chip('prio', PRIORITY[k], { level: k }))),
        ],
        patch: { booking: { ...draft, to: p.id } },
      };
    case 'prio':
      return draft.from && draft.to
        ? bookingCard(c, draft.from, draft.to, p.level as BookingDraft['priority'])
        : {
            blocks: [text('Let us start again.'), chips([chip('book:start', 'Book a trip')])],
            patch: { booking: null },
          };
    case 'repeat': {
      const l = lastTrip(c);
      return l
        ? bookingCard(c, l.from, l.to)
        : { blocks: [text('You have no earlier trip to repeat.'), chips([chip('book:start', 'Book a trip')])] };
    }
    case 'route':
      return bookingCard(c, p.from, p.to);
    case 'where':
      return where(c);
    case 'stuck':
      return stuck();
    case 'stuck:done':
      return {
        blocks: [
          text('Thank you. If the robot still does not move, tap Call supervisor.'),
          chips([chip('supervisor', 'Call supervisor')]),
        ],
      };
    case 'supervisor':
      return {
        blocks: [
          confirm('Call your supervisor?', ['They get a message with your name and fleet.'], {
            kind: 'call-supervisor',
          }),
        ],
      };
    case 'cancel': {
      const open = c.trips.filter((x) => x.cancellable);
      if (!open.length)
        return {
          blocks: [
            text('You have no trip that can be cancelled. A trip cannot be cancelled once a robot is on its way.'),
          ],
        };
      const pick = p.id ? open.find((x) => x.bookingId === p.id) : open.length === 1 ? open[0] : undefined;
      if (!pick)
        return {
          blocks: [
            text('Which trip?'),
            chips(open.map((x) => chip('cancel', `${x.tripId}: ${x.fromName} to ${x.toName}`, { id: x.bookingId }))),
          ],
        };
      return {
        blocks: [
          confirm(`Cancel trip ${pick.tripId}?`, [`${pick.fromName} to ${pick.toName}`], {
            kind: 'cancel-trip',
            bookingId: pick.bookingId,
            tripId: pick.tripId,
          }),
        ],
      };
    }
    default:
      return null;
  }
}

/** Booking, status and help for the person on the floor: short, plain, tap-first. */
export function operatorReply(i: AtiAiInput): Reply {
  const tapped = byAction(i);
  if (tapped) return tapped;
  const c = i.context;
  const t = i.text ?? '';
  const draft = c.booking ?? {};
  // free text
  if (has(t, /\b(stuck|not moving|won'?t move|blocked|broken)\b/)) return stuck();
  if (has(t, /\b(supervisor|help me|call someone)\b/)) return operatorReply({ ...i, actionId: 'supervisor' });
  if (has(t, /\b(cancel)\b/)) return operatorReply({ ...i, actionId: 'cancel' });
  if (has(t, /\b(repeat|again|same trip)\b/)) return operatorReply({ ...i, actionId: 'repeat' });
  if (has(t, /\b(delay|late|slow|why)\b/)) return delayed(c);
  if (has(t, /\b(where|status|track|eta|how long)\b/)) return where(c);
  if (has(t, /\b(send|book|call|move|bring|take|fetch|need|trip)\b/)) {
    const to = findInSentence(t, c.stations, /\bto\s+(.+?)(?:\s+from\b|$)/i);
    const from = findInSentence(t, c.stations, /\bfrom\s+(.+?)(?:\s+to\b|$)/i).filter(
      (s: Named) => !to.length || s.id !== to[0].id,
    );
    const one = (a: Named[]) => (a.length === 1 ? a[0] : null);
    const f = one(from);
    const d = one(to);
    if (f && d && f.id !== d.id) return bookingCard(c, f.id, d.id);
    if (d && !f)
      return {
        blocks: [text(`To ${d.name}. Where should the robot pick up?`), chips(stationChips(c, 'pick', d.id))],
        patch: { booking: { to: d.id } },
      };
    if (to.length > 1)
      return {
        blocks: [text('Which place do you mean?'), chips(to.map((s) => chip('drop', s.name, { id: s.id })))],
        patch: { booking: { ...draft } },
      };
    return operatorReply({ ...i, actionId: 'book:start' });
  }
  return {
    blocks: [
      text('I can book a robot, tell you where it is, or help when something is stuck. What do you need?'),
      chips([chip('book:start', 'Book a trip'), chip('where', 'Where is my robot?'), chip('stuck', 'Robot is stuck')]),
    ],
  };
}

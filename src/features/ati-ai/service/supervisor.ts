import {
  ANOMALIES,
  FAILURES_30D,
  IDLE_BY_STATION,
  SHIFT_HOURS,
  SHIFT_TRIPS,
  TRIPS_PER_DAY,
  daysOf,
  dayLabel,
  kpisFor,
  lastDays,
  weekday,
} from '../data/mockData';
import type { AtiAiInput, Block, Chip, Range } from '../types';
import { actions, chip, chips, has, text, type Reply } from './blocks';

const RANGE_NAME: Record<Range, string> = { today: 'today', '7d': 'the last 7 days', '30d': 'the last 30 days' };
const sign = (n: number) => `${n > 0 ? '+' : ''}${n}%`;
const tail = (what: string): Block =>
  actions([
    chip('pin', 'Pin to dashboard', { what }),
    chip('export', 'Export CSV', { what }),
    chip('export-pdf', 'Export PDF', { what }),
    chip('followup', 'Ask a follow-up'),
  ]);

function summary(range: Range): Reply {
  const k = kpisFor('today');
  const peak = SHIFT_HOURS[SHIFT_TRIPS.indexOf(Math.max(...SHIFT_TRIPS))];
  const k7 = kpisFor(range === 'today' ? '7d' : range);
  return {
    blocks: [
      text("Here is how today's shift is going so far:"),
      {
        type: 'kpi_tiles',
        tiles: [
          {
            label: 'Trips finished',
            value: String(k.trips),
            delta: sign(k.tripsDelta) + ' vs yesterday',
            good: k.tripsDelta >= 0,
          },
          {
            label: 'Availability',
            value: `${k7.availability}%`,
            delta: `${k7.availabilityPrev}% before`,
            good: k7.availability >= k7.availabilityPrev,
          },
          { label: 'On-time (SLA)', value: `${k7.sla}%`, delta: `${k7.slaPrev}% before`, good: k7.sla >= k7.slaPrev },
          {
            label: 'Robot idle time',
            value: `${k7.idle}%`,
            delta: `${k7.idlePrev}% before`,
            good: k7.idle <= k7.idlePrev,
          },
        ],
      },
      {
        type: 'chart',
        kind: 'bar',
        title: 'Trips finished per hour (today)',
        points: SHIFT_HOURS.map((h, i) => ({ label: `${h}:00`, value: SHIFT_TRIPS[i] })),
      },
      text(
        `• Output is steady, peaking at ${peak}:00 with ${Math.max(...SHIFT_TRIPS)} trips.\n• The dip at 11:00 to 13:00 matches the lunch break, not a fault.\n• AMR-007 had 2 faults this morning: it is the one to watch.\nSuggested action: ask maintenance to inspect AMR-007's drive before the afternoon shift.`,
      ),
      tail('shift summary'),
    ],
  };
}
function whyLow(): Reply {
  const y = TRIPS_PER_DAY[28];
  const avg = Math.round(TRIPS_PER_DAY.slice(14, 28).reduce((a, b) => a + b, 0) / 14);
  return {
    blocks: [
      text(
        `Yesterday finished ${y} trips, ${Math.round(((avg - y) / avg) * 100)}% below the 2-week average of ${avg}.`,
      ),
      {
        type: 'chart',
        kind: 'bar',
        title: 'Trips per day, last 7 days',
        points: lastDays(TRIPS_PER_DAY, 7).map((v, i) => ({ label: weekday(23 + i), value: v })),
      },
      text(
        '• The ASRS lift was down from 13:10 to 15:15 (2 hours): 6 stations waited for material.\n• 3 robots queued at the east strip intersection at the shift change.\n• AMR-007 was out for 40 minutes with a drive fault.\nSuggested action: add a second lift-fault alert so the line is told within 5 minutes.',
      ),
      tail('why throughput was low yesterday'),
    ],
  };
}
function compare(): Reply {
  const k = kpisFor('7d');
  return {
    blocks: [
      text('This week against last week:'),
      {
        type: 'table',
        title: 'Week on week',
        columns: ['Metric', 'This week', 'Last week', 'Change'],
        rows: [
          [
            'Trips finished',
            String(k.trips),
            String(Math.round(k.trips / (1 + k.tripsDelta / 100))),
            sign(k.tripsDelta),
          ],
          [
            'Availability',
            `${k.availability}%`,
            `${k.availabilityPrev}%`,
            `${Math.round((k.availability - k.availabilityPrev) * 10) / 10} pts`,
          ],
          ['On-time (SLA)', `${k.sla}%`, `${k.slaPrev}%`, `${Math.round((k.sla - k.slaPrev) * 10) / 10} pts`],
          ['Robot idle time', `${k.idle}%`, `${k.idlePrev}%`, `${Math.round((k.idle - k.idlePrev) * 10) / 10} pts`],
        ],
      },
      {
        type: 'chart',
        kind: 'line',
        title: 'Trips per day, 14 days',
        points: lastDays(TRIPS_PER_DAY, 14).map((v, i) => ({ label: dayLabel(16 + i), value: v })),
      },
      text(
        '• Volume is up, but the dip on Wednesday held back the average.\n• Idle time is slightly higher: more waiting at ASRS.\nSuggested action: review the ASRS pick-up schedule with the store team.',
      ),
      tail('week on week'),
    ],
  };
}
function failures(range: Range, monthly: boolean): Reply {
  const r = monthly ? '30d' : range;
  const rows = FAILURES_30D.map((f) => ({
    robot: f.robot,
    n: r === '30d' ? f.failures : r === '7d' ? f.last7 : Math.min(f.last7, 2),
  })).sort((a, b) => b.n - a.n);
  return {
    blocks: [
      text(`Failures by robot for ${RANGE_NAME[r]}:`),
      {
        type: 'chart',
        kind: 'bar',
        title: 'Failures per robot',
        points: rows.slice(0, 6).map((x) => ({ label: x.robot.replace('AMR-', ''), value: x.n })),
      },
      {
        type: 'table',
        title: 'Detail',
        columns: ['Robot', 'Failures', 'MTBF (hours)'],
        rows: FAILURES_30D.slice(0, 5).map((f) => [
          f.robot,
          String(r === '30d' ? f.failures : r === '7d' ? f.last7 : Math.min(f.last7, 2)),
          String(f.mtbfHours),
        ]),
      },
      text(
        '• AMR-007 is far ahead of the others: 14 faults in 30 days, 9 of them in the last 7.\n• The rest of the fleet is steady.\nSuggested action: take AMR-007 off the floor for a drive inspection.',
      ),
      tail('robot failures'),
    ],
  };
}
function idle(stationNames: string[]): Reply {
  const rows = IDLE_BY_STATION.map((x, i) => ({ station: stationNames[i] ?? x.station, idlePct: x.idlePct }));
  return {
    blocks: [
      text('Share of the shift each station waited for a robot or a load:'),
      {
        type: 'chart',
        kind: 'bar',
        title: 'Idle time by station (%)',
        unit: '%',
        points: rows.map((x) => ({ label: x.station.slice(0, 10), value: x.idlePct })),
      },
      text(
        `• ${rows[0].station} waits the most (${rows[0].idlePct}%).\n• The three busiest stations are all near the ASRS.\nSuggested action: move one robot's parking spot closer to ${rows[0].station}.`,
      ),
      tail('idle time by station'),
    ],
  };
}
function anomalies(): Reply {
  return {
    blocks: [
      text(`I found ${ANOMALIES.length} things that look unusual:`),
      {
        type: 'table',
        title: 'Anomalies',
        columns: ['#', 'What'],
        rows: ANOMALIES.map((a, i) => [String(i + 1), a.text]),
      },
      text('Suggested action: start with AMR-007, it explains most of the failures.'),
      tail('anomalies'),
    ],
  };
}

/** The proactive cards on the empty state (also usable as the quick actions): what looks wrong right now. */
export const INSIGHTS: { id: string; text: string }[] = [
  { id: 'anomalies', text: ANOMALIES[0].text },
  { id: 'idle', text: `${IDLE_BY_STATION[0].station} waits ${IDLE_BY_STATION[0].idlePct}% of the shift for a robot.` },
];

/** Insight, report and comparison answers from the mock dataset, picked by keywords; an unknown question gets three suggestions, never a dead end. */
export function supervisorReply(i: AtiAiInput): Reply {
  const t = i.text ?? '';
  const range = i.context.range;
  const names = i.context.stations.map((s) => s.name);
  switch (i.actionId) {
    case 'summary':
      return summary(range);
    case 'why-low':
      return whyLow();
    case 'compare':
      return compare();
    case 'failures':
      return failures(range, true);
    case 'idle':
      return idle(names);
    case 'anomalies':
      return anomalies();
    case 'pin':
      return { blocks: [text('Pinned to your dashboard (prototype: nothing was saved).')] };
    case 'export':
    case 'export-pdf':
      return { blocks: [text(`Export started (prototype: no file is created).`)] };
    case 'followup':
      return { blocks: [text('What would you like to know more about?'), chips(fallbackChips())] };
    default:
  }
  if (has(t, /summar|shift|today|how is it going/)) return summary(range);
  if (has(t, /throughput.*(low|drop|down)|why.*(low|drop|down)|yesterday/)) return whyLow();
  if (has(t, /compar|\bvs\b|versus|last week|week on week/)) return compare();
  if (has(t, /fail|fault|breakdown|broken/)) return failures(range, has(t, /month/));
  if (has(t, /idle|waiting|wait time/)) return idle(names);
  if (has(t, /anomal|unusual|strange|odd|wrong/)) return anomalies();
  return { blocks: [text('I am not sure I understood. Here is what I can look into:'), chips(fallbackChips())] };
}
const fallbackChips = (): Chip[] => [
  chip('summary', "Summarize today's shift"),
  chip('anomalies', 'Any anomalies?'),
  chip('failures', 'Robots with the most failures'),
];
export { daysOf };

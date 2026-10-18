import type { Category, SupportContext, Ticket, TicketMessage } from '../types';

/** ALL the dummy content of the support widget: knowledge-base fixes, seed tickets, the agent's canned replies and the common issues. */
export const AGENT = 'Priya from Ati Support';
export const CATEGORY_ORDER: Category[] = ['robot', 'trip', 'login', 'bug', 'question'];
/** The chips of the home screen: the category they start the chat with. */
export const COMMON_ISSUES: { id: string; category: Category }[] = [
  { id: 'stuck', category: 'robot' },
  { id: 'tripFailed', category: 'trip' },
  { id: 'login', category: 'login' },
  { id: 'bug', category: 'bug' },
];
export const KB: Record<Category, { title: string; steps: string[] }> = {
  robot: {
    title: 'Robot stuck',
    steps: [
      'Clear anything blocking the robot.',
      'Press Resume on the robot.',
      'If it still will not move, re-localize it from the robot screen.',
    ],
  },
  trip: {
    title: 'Trip failed',
    steps: [
      'Open the trip in History and read the reason shown.',
      'Check that both stations are free and on the map.',
      'Book the trip again.',
    ],
  },
  login: {
    title: "Can't log in",
    steps: [
      'Check that Caps Lock is off and the username has no spaces.',
      'Ask your configurator to reset your password.',
      'Try again in a new browser tab.',
    ],
  },
  bug: {
    title: 'Something looks wrong',
    steps: [
      'Reload the page (Ctrl+R).',
      'Sign out and in again.',
      'If it happens again, note what you did just before it.',
    ],
  },
  question: {
    title: 'A question',
    steps: ['Look in the menu on the left for the page you need.', 'Ask Ati AI (top right) for a quick answer.'],
  },
};
/** Canned agent replies by category, used in turn. */
export const AGENT_REPLIES: Record<Category, string[]> = {
  robot: [
    'Thanks. I can see the robot in our fleet view. Can you tell me what the robot screen shows right now?',
    'Got it. I am sending a recovery command; please keep the area clear.',
    'The robot should move now. Please confirm it is back on its route.',
  ],
  trip: [
    'Thanks for the details. I am checking the trip log for the failure reason.',
    'I found it: the destination was busy when the robot arrived. Booking again should work.',
    'I have noted this for the engineering team.',
  ],
  login: [
    'Sorry about that. I can see your account. Which username are you using?',
    'I have asked your configurator to send a reset link. It may take a few minutes.',
  ],
  bug: [
    'Thanks for reporting this. Could you tell me which page you were on and what you pressed?',
    'I could reproduce it. I have passed it to our engineers with your details.',
  ],
  question: [
    'Happy to help. Could you tell me a bit more about what you want to do?',
    'That is done from the Settings page. I can walk you through it if you like.',
  ],
};
export const GREETING = (name: string, id: string) =>
  `Hi ${name}, this is Priya from Ati Support. I have your ticket ${id} and I am looking at it now.`;
export const OFFLINE_NOTE = (id: string, opens: string, phone: string) =>
  `Our team is offline. We've logged your ticket ${id} and will reply from ${opens}. For urgent issues, call ${phone} during support hours.`;

const ctx = (route: string, robotId?: string): SupportContext => ({
  user: { name: 'Demo user', username: 'demo', role: 'operator' },
  site: 'ECC plant, Bengaluru',
  account: 'Ati Demo Customer',
  route,
  robotId,
  alerts: [],
  atiFlowVersion: '4.0',
  firmwareVersion: '3.2.1',
  device: 'Browser',
});
const H = 3_600_000;
const msg = (id: string, from: TicketMessage['from'], text: string, at: number): TicketMessage => ({
  id,
  from,
  author: from === 'agent' ? AGENT : undefined,
  text,
  at,
});
/** Three tickets so the list is never empty: one Open, one Pending with an unread agent reply, one Solved. */
export function seedTickets(now: number): { ticket: Ticket; messages: TicketMessage[] }[] {
  return [
    {
      ticket: {
        id: 'ATI-1038',
        subject: 'AMR-003 stuck near the charging dock',
        category: 'robot',
        severity: 'blocking',
        status: 'open',
        createdAt: now - 5 * H,
        updatedAt: now - 4 * H,
        unread: 0,
        robotId: 'AMR-003',
        tags: [],
        context: ctx('/supervisor/livefloor', 'AMR-003'),
        agentJoined: true,
      },
      messages: [
        msg('a1', 'user', 'AMR-003 does not leave the charging dock after charging.', now - 5 * H),
        msg('a2', 'agent', 'Thanks, I am looking at AMR-003 now.', now - 4 * H),
      ],
    },
    {
      ticket: {
        id: 'ATI-1031',
        subject: 'Trip history shows the wrong time zone',
        category: 'bug',
        severity: 'degraded',
        status: 'pending',
        createdAt: now - 30 * H,
        updatedAt: now - 2 * H,
        unread: 1,
        tags: [],
        context: ctx('/operator/history'),
        agentJoined: true,
      },
      messages: [
        msg('b1', 'user', 'The times in History are 5 hours off.', now - 30 * H),
        msg('b2', 'agent', 'Could you share your browser and the time you see for the last trip?', now - 2 * H),
      ],
    },
    {
      ticket: {
        id: 'ATI-1019',
        subject: 'How do I add a new station?',
        category: 'question',
        severity: 'question',
        status: 'solved',
        createdAt: now - 96 * H,
        updatedAt: now - 90 * H,
        unread: 0,
        tags: [],
        context: ctx('/configurator/maps'),
        agentJoined: true,
      },
      messages: [
        msg('c1', 'user', 'How do I add a new station to a map?', now - 96 * H),
        msg(
          'c2',
          'agent',
          'Open the map in the Map Editor, choose Edit as draft, then the Stations tool, and tap the map.',
          now - 90 * H,
        ),
      ],
    },
  ];
}
/** The reply that arrives on the Open ticket a little after the person opens the app, so notifications can be seen. */
export const SCRIPTED_REPLY = {
  ticketId: 'ATI-1038',
  text: 'Update: I cleared the dock fault remotely. Please check AMR-003 and tell me if it is moving.',
  afterMs: 20_000,
};
/** English names kept in the ticket (the agent reads English whatever language the screen is in). */
export const CATEGORY_EN: Record<Category, string> = {
  robot: 'Robot',
  trip: 'Trip',
  login: 'Login',
  bug: 'Bug or error',
  question: 'Question',
};
export const SEVERITY_EN = { blocking: 'Blocking', degraded: 'Degraded', question: 'Just a question' } as const;
/** Used when the floor feed is not running (so there are no live robots to offer). */
export const FALLBACK_ROBOTS = ['AMR-003', 'AMR-007', 'AMR-011'];

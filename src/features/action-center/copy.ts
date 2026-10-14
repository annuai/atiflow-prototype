/** Every user-facing string of the Action Center. */
export const copy = {
  title: 'Action Center', subtitle: 'Robots that need a person. Take a call, fix the robot, mark it resolved.',
  search: 'Search…',
  tabs: { open: (n: number) => `Open (${n})`, mine: (n: number) => `Mine (${n})`, log: 'Resolved log' },
  strip: {
    ok: 'No robot is asking for help', okDetail: 'Calls appear here the moment a robot is blocked, stuck, in a deadlock or needs a person.',
    warn: (n: number) => `${n} ${n === 1 ? 'call needs' : 'calls need'} someone`, critical: (n: number) => `${n} urgent ${n === 1 ? 'call' : 'calls'}`,
    detail: (open: number, taken: number, oldest: string) => `${open} not taken yet · ${taken} being handled · longest wait ${oldest}`,
  },
  empty: { open: 'Nothing to handle', openHint: 'When a robot calls for help it shows here, most urgent first.', mine: 'You have not taken any call', mineHint: 'Press “Take it” on a call so nobody else walks to the same robot.', log: 'No resolved calls yet', logHint: 'Every call that is resolved is kept here, and can be exported.' },
  kind: { blocked: 'Blocked', fault: 'Error', deadlock: 'Deadlock', stuck: 'Waiting too long', battery: 'Low battery', rule: 'Off path' },
  row: { take: 'Take it', release: 'Give back', resolve: 'Resolve', locate: 'Locate', takenBy: (n: string) => `${n} is on it`, you: 'You are on it', repeat: (n: number) => `${n + 1}${n === 1 ? 'nd' : n === 2 ? 'rd' : 'th'} time here today`, why: 'What is happening', fix: 'What to do', robot: 'Robot now' },
  resolve: { title: 'Resolve call', subtitle: (id: string, title: string) => `${id} · ${title}`, what: 'What did you do?', note: 'Note for the next shift', notePlaceholder: 'Optional', action: 'Mark resolved', done: (id: string) => `${id} resolved`,
    options: ['Cleared the obstacle', 'Moved the robot by hand', 'Reset the error', 'Sent to a charger or swapped', 'Fixed a map or route problem', 'Other'] },
  log: { export: 'Export CSV', columns: { call: 'Call', kind: 'What', robots: 'Robots', fleet: 'Fleet', opened: 'Opened', waited: 'Waited', by: 'Handled by', result: 'Result' }, exported: (n: number) => `${n} calls exported`, none: 'Nothing to export yet' },
  taken: 'Call taken', released: 'Call given back',
} as const;

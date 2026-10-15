/** Every user-facing string of booking a trip and of the consolidated history. */
export const copy = {
  book: {
    title: 'Book a trip', subtitle: 'Call a robot from one station to another. It goes straight to the fleet.',
    stepOf: (n: number, total: number) => `Step ${n} of ${total}`, changeRobot: 'Change robot', changeRobotHint: 'Tap to change the robot', stationsHint: 'Where should it go?', robot: 'Robot', robotHint: 'Which robot do you want to call?', total: (n: number) => (n === 1 ? '1 robot' : `${n} robots`), free: (n: number) => `${n} free now`,
    fleet: 'Fleet', start: 'Start station', end: 'End station', pick: 'Select a station', swap: 'Swap start and end', mapTitle: 'Or tap the stations on the map',
    mapHint: (step: 'start' | 'end' | 'done') => (step === 'start' ? 'Tap the start station' : step === 'end' ? 'Now tap the end station' : 'Tap a station to start over'),
    submit: 'Book trip', summary: (robot: string, a: string, b: string) => `${robot}: ${a} → ${b}`,
    booked: (trip: string) => `Trip ${trip} booked`, bookedHint: 'A robot is being sent. Follow it in History.', noRobots: 'No robots on this fleet', noRobotsHint: 'This fleet has no robot on the floor right now, so a trip cannot be booked.',
    noStations: 'No stations on the map', noStationsHint: 'This fleet\'s map has no stations to book trips between.', loading: 'Loading the map…',
  },
  routes: {
    title: 'Trips', anyRobot: 'Any robot', subtitle: 'Trips your team has set up. Tap Book trip to send a robot.', book: 'Book trip', approval: 'Needs approval',
    custom: { title: 'Custom trip', hint: 'Choose a robot and any two stations.', cta: 'Book a custom trip' }, back: 'Trips',
    booked: (trip: string) => `Trip ${trip} booked`, sent: (trip: string) => `Trip ${trip} sent for approval`, sentHint: 'Another operator approves it, then a robot is sent. Follow it in History.',
  },
  history: {
    title: 'History', subtitle: 'Your requests, your approvals and the trips you booked, in one list.',
    filters: { all: 'All', request: 'Requests', approval: 'Approvals', trip: 'Booked trips' }, kinds: { request: 'Request', approval: 'Approval', trip: 'Booked trip' },
    empty: { title: 'Nothing yet', hint: 'Requests, approvals and booked trips show here as they happen.' }, none: 'Nothing in this list yet',
    cancel: 'Cancel trip', robot: (r: string) => `Robot ${r}`,
  },
} as const;

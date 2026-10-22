/** First-run onboarding: setup progress, milestone dialogs, the welcome dialog, empty states and the walkthrough. */
export const onboarding = {
  setup: {
    title: 'Setup progress',
    count: (done: number, total: number) => `${done} of ${total}`,
    complete: 'Setup complete',
    completeHint: 'Everything is in place.',
    open: 'Open setup progress',
    panelTitle: 'Set up your site',
    panelHint: 'Do these in order. Each one builds on the one before.',
    go: 'Go',
    skip: 'I have no hardware',
    skipped: 'Skipped',
    optional: 'Optional',
    done: 'Done',
    next: 'Next',
    hide: 'Hide',
    showMe: 'Show me',
    steps: {
      robot: {
        title: 'Add a robot',
        hint: 'Register your first robot.',
        next: 'Add your first robot',
      },
      map: {
        title: 'Create a map',
        hint: "Generate one from a robot's run data, or import a map file.",
        next: 'Create your first map',
      },
      hardware: {
        title: 'Add hardware',
        hint: 'Summon buttons, hooters and cameras. Skip it if you have none.',
        next: 'Add your hardware',
      },
      fleet: {
        title: 'Create a fleet',
        hint: 'Group your robots and hardware and give the fleet a map.',
        next: 'Create your first fleet',
      },
      materials: {
        title: 'Add materials',
        hint: 'Import or add the materials your workflows move.',
        next: 'Add your materials',
      },
      workflow: {
        title: 'Build a workflow',
        hint: 'Publish your first workflow so the robots know what to do.',
        next: 'Build your first workflow',
      },
    },
  },
  milestone: {
    skip: 'Skip for now',
    recent: 'Recently added',
    draft: 'Draft',
    fleetCount: (robots: number, map: string) => `${robots} ${robots === 1 ? 'robot' : 'robots'} · ${map}`,
    noMapYet: 'No map yet',
    robot: {
      title: 'Congratulations!',
      body: 'You have added your first robot. Next, add your first map and set up its stations and routes.',
      cta: 'Add your first map',
    },
    map: {
      title: 'Well done!',
      body: 'Your map is created. Do you want to start adding stations right away or keep it for later?',
      cta: 'Take me to Map Editor',
    },
    fleet: {
      title: 'Your fleet is ready',
      body: 'The map and robots are assigned. Next, add the materials your workflows will move.',
      cta: 'Add materials',
    },
  },
  welcome: {
    title: 'Welcome to Ati Flow',
    whatsNew: "What's New",
    i1: {
      title: 'Unified Interface',
      body: 'Ati Flow now brings all operational tools together in a single, cohesive interface, designed from the ground up on extensive usability research across every workflow.',
    },
    i2: {
      title: 'Streamlined Navigation',
      body: 'Consolidated menus, contextual actions and an intuitive sidebar mean you spend less time searching and more time managing.',
    },
    i3: {
      title: 'Enhanced Fleet Visibility',
      body: 'Real-time robot status, zone mapping and fleet health are now surfaced at a glance, with improved data density and clarity.',
    },
    i4: {
      title: 'Accessibility & Performance',
      body: 'Rebuilt for speed and inclusivity, with optimized load times and WCAG-aligned contrast and interaction patterns.',
    },
    legal:
      "Your use of Ati Flow is governed by your organization's agreement with Ati. Starting or skipping the walkthrough does not change those terms.",
    skip: 'Skip Walkthrough',
    start: 'Start Walkthrough',
  },
  tour: {
    next: 'Next',
    prev: 'Back',
    done: 'Done',
    close: 'Close the walkthrough',
    progress: (n: number, total: number) => `${n} of ${total}`,
    configurator: {
      robots: {
        title: 'Start with robots',
        body: 'Register every robot here first. Each robot is added once and then given to a fleet.',
      },
      addRobot: {
        title: 'Add a robot',
        body: 'Give it a name, a type and its hardware ID. A new robot stays offline until it connects.',
      },
      maps: {
        title: 'Maps',
        body: "Maps tell your robots where they can drive. Create one from a robot's run data, or import a map file.",
      },
      createMap: {
        title: 'Create your first map',
        body: 'Generate a map, then open it in the Map Editor to add stations and routes.',
      },
      hardware: {
        title: 'Hardware',
        body: 'Add summon buttons, hooters and cameras. Skip this if your site has none.',
      },
      fleets: {
        title: 'Make a fleet',
        body: 'A fleet brings a map, robots and hardware together. You need at least one map before you can make one.',
      },
      master: {
        title: 'Master data',
        body: 'Import or add the materials your workflows move, and set up staging areas.',
      },
      workflows: {
        title: 'Workflows',
        body: 'Build a workflow from the steps your robots follow, then publish it. This is the last step of the setup.',
      },
      setup: {
        title: 'Track your setup',
        body: 'This card shows what is done and what to do next. Click it any time.',
      },
    },
    supervisor: {
      dashboard: {
        title: 'Dashboard',
        body: 'The floor at a glance. Only the red and amber items need you.',
      },
      live: {
        title: 'Live Floor',
        body: 'Watch every robot in 3D or 2D, follow one, and stop a robot or a whole fleet in an emergency.',
      },
      action: {
        title: 'Action Center',
        body: 'Robots that need a person show up here. Take a call and mark it resolved.',
      },
      reports: {
        title: 'Reports',
        body: 'How the fleet performed over a period, compared with the one before.',
      },
    },
    operator: {
      book: {
        title: 'Request material and book trips',
        body: 'Ask for material or send a robot from one station to another. Add several, then call them together.',
      },
      approve: {
        title: 'Approve',
        body: 'Requests that need your approval wait here. Approve or reject with a reason.',
      },
      history: {
        title: 'History',
        body: 'Everything you requested, approved and booked, in one list. Open an item to see where it stands.',
      },
      action: {
        title: 'Action Center',
        body: 'Robots that need a person show up here. Take a call and mark it resolved.',
      },
    },
  },
} as const;

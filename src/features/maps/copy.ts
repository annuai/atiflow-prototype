/** Every user-facing string of the Maps page. */
export const copy = {
  title: 'Maps', subtitle: 'Manage and configure deployment maps for your robot fleets.',
  import: 'Import', create: 'Create New Map', search: 'Search maps by name or fleet…', sortBy: (label: string) => `Sort By: ${label}`,
  sorts: { name: 'Name', version: 'Version' },
  card: { fleet: 'Fleet', updated: 'Last updated', unassigned: 'Unassigned', version: (v: number) => `v${v}` },
  noMatch: (q: string) => `No maps match “${q}”.`,
  empty: { title: 'Create a new map to get started', description: 'Maps tell your robots where they can drive. Generate one from a robot’s run data, or import an existing map file.' },
  generate: {
    title: 'Generate New Map', subtitle: 'Configure and generate a new deployment map for your robot fleet.',
    name: 'Map Name', namePlaceholder: 'e.g. warehouse_east_floor2',
    robot: 'Robot', robotSearch: 'Search Robots', robotNone: 'No robots match.', robotChange: 'Change robot', connected: 'Connected', disconnected: 'Disconnected', noRobots: 'Register a robot first (Robots page) to generate a map.',
    runData: 'Run-Data', runDataHint: 'Recorded drive data the map is generated from.', runDataPlaceholder: 'Select run data…', runDataNeedsRobot: 'Select a robot first', runDataLoading: 'Loading run data…', runDataNone: 'This robot has no run data yet.',
    version: 'Map Version', optional: 'OPTIONAL', zMin: 'Z Min', zMax: 'Z Max', zHint: 'Height range (metres) of the points used to build the map.', posegraph: 'Posegraph Optimization', posegraphHint: 'Refines the map after generation. Takes longer.',
    cancel: 'Cancel', submit: 'Generate Map',
    errors: { name: 'Map name is required', nameTaken: (n: string) => `A map named "${n}" already exists`, robot: 'Select a robot', runData: 'Select run data', version: 'Select a map version', z: 'Z Min must be lower than Z Max', number: 'Enter a number' },
    notDefined: { title: 'Map generation starts here', body: 'The generation flow is not defined yet, so nothing was created.' },
  },
  importMap: {
    title: 'Import map', subtitle: 'Upload an existing map file.', dropHint: (types: string, mb: number) => `${types} (max. ${mb} MB)`, back: 'Cancel', next: 'Import',
    errors: { type: 'Unsupported file format', typeBody: (types: string) => `Upload one of: ${types}.`, size: 'File too large', sizeBody: (mb: number) => `The file is bigger than ${mb} MB.` },
    notDefined: { title: 'Map file received', body: 'What happens after the upload is not defined yet, so no map was added.' },
  },
} as const;

/** Every user-facing string of Master Data lives here (labels, hints, errors), so wording changes never touch components. */
const plural = (n: number, one: string, many = one + 's') => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;

export const copy = {
  title: 'Master Data',
  tabs: {
    materials: { label: 'Materials', subtitle: 'Manage the materials and material groups your workflow builder uses.' },
    'staging-area': { label: 'Staging Area', subtitle: 'Manage the staging areas' },
  },
  materials: {
    note: 'Only materials selected from the material list are shown here. Materials can’t be deleted once added, as they may be used in workflows.',
    searchPlaceholder: 'Search materials by material groups, code, name',
    allGroups: 'All groups',
    groupFilter: (name: string) => `Group: ${name}`,
    addMore: 'Add more from API',
    add: 'Add Material',
    columns: { material: 'Material', group: 'Material Group', fleet: 'Fleet' },
    groupHint: 'Group the material belongs to',
    fleetHint: 'Fleets this material is assigned to. Assign materials from the fleet’s page.',
    unassigned: 'Unassigned',
    noGroup: '—',
    noMatch: (q: string) => `No materials match “${q}”.`,
    empty: {
      title: 'No materials yet',
      description:
        'Import your materials from your ERP, upload a file or add one by hand. Workflows can only use materials that are assigned to their fleet.',
      action: 'Add materials',
    },
    rowMenu: { label: 'Row actions', edit: 'Edit details', fleets: 'Manage fleets' },
  },
  fleets: {
    inUse: {
      title: 'Remove the material from the workflow before you can unassign',
      body: (code: string, fleets: string[]) => `${code} is used in ${fleets.join(', ')}.`,
    },
    title: (code: string) => `Fleets for ${code}`,
    subtitle: 'The Workflow Builder of a fleet only offers the materials assigned to it.',
    save: 'Save',
    none: 'No fleets exist yet.',
  },
  edit: {
    title: 'Edit material',
    subtitle: 'Change the name or group. The code cannot be changed.',
    save: 'Save changes',
    saved: 'Material updated',
  },
  method: {
    title: 'Add materials',
    subtitle: 'Choose how you’d like to add materials to your master data.',
    cancel: 'Cancel',
    next: 'Continue',
    options: {
      api: { title: 'Import from API', description: 'Sync materials directly from your ERP or inventory system.' },
      file: { title: 'Import from CSV/XLSX file', description: 'Upload a file to add multiple materials at once.' },
      manual: {
        title: 'Enter material details manually',
        description: 'Add a single material by filling in its details.',
      },
    },
  },
  api: {
    title: 'Import from API',
    subtitle: 'Select the materials to include in your primary material list.',
    addMoreTitle: 'Add more from API',
    addMoreSubtitle:
      'Select materials that aren’t in your list yet. Materials already added are locked and can’t be removed.',
    searchLabel: 'Search materials',
    searchPlaceholder: 'Search by name, code, desc',
    prefixLabel: 'Code prefix',
    prefixAddon: 'Starts with',
    prefixPlaceholder: 'e.g. DCP',
    showing: (total: number) => `Showing ${total.toLocaleString('en-IN')} materials from the API`,
    withPrefix: (total: number, prefix: string) => `${plural(total, 'material')} with code starting “${prefix}”`,
    capped: (limit: number) => `Showing the first ${limit}. Refine the search to narrow it down.`,
    loading: 'Searching…',
    none: 'No materials match your search.',
    selected: (n: number) => `${n.toLocaleString('en-IN')} selected`,
    cancel: 'Cancel',
    create: (n: number) => (n ? `Create material list (${n})` : 'Create material list'),
    add: (n: number) => (n ? `Add ${plural(n, 'material')}` : 'Add materials'),
    done: (n: number) => ({
      title: n === 1 ? 'New Material Added' : 'New Materials Added',
      body: `${plural(n, 'material')} added successfully`,
    }),
  },
  picker: {
    material: 'Material',
    code: 'Material code',
    group: 'Material group',
    status: 'Status',
    status_available: 'Available',
    status_added: 'Added',
    status_duplicate: 'Duplicate',
    status_invalid: 'Invalid',
  },
  upload: {
    title: 'Import from CSV/XLSX file',
    stepOf: (n: number, total: number, what: string) => `Step ${n} of ${total} · ${what}`,
    uploadStep: 'Upload a CSV or XLSX file with one material per row.',
    dropLink: 'Click to upload',
    dropText: ' or drag and drop',
    hint: (types: string, mb: number) => `${types} (max. ${mb} MB)`,
    template: 'Download template',
    fileInfo: (rows: number) => `${rows.toLocaleString('en-IN')} rows found`,
    back: 'Back',
    next: 'Continue',
    errors: {
      format: {
        title: 'Unsupported File Format',
        message:
          'This file is in a format that’s not compatible with AtiFlow. Please use the template and upload the updated file again.',
      },
      size: {
        title: 'File too large',
        message: 'This file is bigger than the allowed size. Split it into smaller files and upload them one by one.',
      },
      empty: {
        title: 'No materials found',
        message: 'The file has no material rows. Use the template and upload the updated file again.',
      },
      columns: {
        title: 'Missing columns',
        message: (names: string[]) =>
          `The file needs these columns: ${names.join(', ')}. Please use the template and upload the updated file again.`,
      },
    },
  },
  review: {
    title: 'Review import',
    rowsFound: (rows: number, file: string) => `${rows.toLocaleString('en-IN')} rows found in ${file}.`,
    back: 'Back',
    import: (n: number) => (n ? `Import ${plural(n, 'material')}` : 'Import materials'),
  },
  progress: {
    title: 'Importing materials',
    body: (n: number, file: string) =>
      `Adding ${plural(n, 'material')} from ${file}. You can close this window, the import keeps running.`,
    count: (done: number, total: number) =>
      `${done.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')} materials imported`,
    cancel: 'Cancel import',
    background: 'Run in background',
    cancelled: (done: number) => ({
      title: 'Import cancelled',
      body: `${plural(done, 'material')} were already added and stay in the list.`,
    }),
    done: (n: number) => ({
      title: n === 1 ? 'New Material Added' : 'New Materials Added',
      body: `${plural(n, 'material')} added successfully`,
    }),
  },
  manual: {
    title: 'Add material',
    subtitle: 'Enter the details for a single material.',
    nameLabel: 'Material name',
    namePlaceholder: 'e.g. Steel Bracket 40mm',
    codeLabel: 'Material code',
    codePlaceholder: 'MAT001',
    groupLabel: 'Material group',
    cancel: 'Cancel',
    submit: 'Add material',
    done: { title: 'New Material Added', body: 'New Material was added successfully' },
  },
  staging: {
    cardUtilisation: 'Utilised cells',
    layoutTitle: (name: string) => `${name} cell layout`,
    selected: 'Selected',
    modes: { view: 'View', manage: 'Manage' },
    manageHint:
      'Click an available or blocked cell to block or release it. Reserved and filled cells are controlled by workflows.',
    cellLabel: (row: number, col: number, state: string) => `Row ${row}, column ${col}: ${state}`,
    empty: 'Staging areas appear here once they are set up.',
  },
  time: { justNow: 'Just now' },
  /** Titles of the empty states (the subtext is the explanation next to each list). */
  emptyTitles: { fleets: 'No fleets yet', staging: 'No staging areas yet' },
} as const;

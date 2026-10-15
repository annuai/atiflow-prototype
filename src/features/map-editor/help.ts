/**
 * Every tooltip of the Map Editor, in one place. Plain sentences keyed by a stable id, so they can be edited without touching a component, and translated later:
 * to localise, make this a map per language (`HELP_BY_LOCALE[locale]`) and have `helpText` pick one. Add a tooltip = add a line here and call `help('your.key')` on the field.
 * Keys: `<panel>.<field>`; `zone.field.<key>` is looked up for the settings listed in the zone type registry.
 */
export const HELP = {
  // palette
  'module.stations':
    'Click the map to place a station: a place where robots stop to pick up, drop off, charge or park. The arrow lets you place a staging area instead.',
  'module.routes':
    'Click points on the map to draw a road. Both lanes are made for you, or choose a one-way road from the arrow.',
  'module.exclusive':
    'Draw a gate or box where only a limited number of robots may be at a time, such as a narrow passage. Others wait outside.',
  'module.zones':
    'Draw an area of the floor with its own rules, such as low speed or no-go. Choose the kind from the arrow.',
  'tool.select': 'Click things on the map or in the list to look at them or change them. Drag a station to move it.',

  // station
  'station.id': 'The station’s unique id. Workflows and trips refer to it, so it never changes once created.',
  'station.type':
    'Station: a normal stop for material. ASRS: the automated storage and retrieval system, an automated store that fetches material by machine. Charging: where robots charge. Parking: where idle robots wait.',
  'station.placement':
    'On route: the station sits on a drawn route and robots drive straight to it. Off route: it sits away from the routes and the system works out the route to it by itself.',
  'station.x': 'Distance east from the left edge (south-west corner) of the site map, in metres.',
  'station.y': 'Distance north from the bottom edge (south-west corner) of the site map, in metres.',
  'station.angle':
    'The direction the robot faces when it stops here, in degrees. 0° points east (right on the map), 90° points north (up).',

  // staging area
  'staging.sherpa': 'The type of robot that works this staging area.',
  'staging.rotation': 'How the grid is turned on the map, in degrees. 0° runs the columns east (right).',
  'staging.position':
    'Where the first cell, A1, sits. Columns (A, B, C…) run along the rotation direction and rows (1, 2, 3…) go to the right of it.',
  'staging.rows': 'Number of rows (1, 2, 3…) in the grid.',
  'staging.cols': 'Number of columns (A, B, C…) in the grid.',
  'staging.cellLength': 'Length of one cell along the column direction, in metres.',
  'staging.cellWidth': 'Width of one cell across the column direction, in metres.',
  'staging.cells': 'Rows × columns. Which cells are filled or blocked is managed in Master Data.',

  // route
  'route.oneWay':
    'Robots can drive this road in one direction only, the way you draw it. Without it, a lane is made for each direction (keep right).',
  'route.type': 'Two lanes: one lane per direction, robots keep right. One lane: a one-way road.',
  'route.start':
    'Where the road starts, in metres from the south-west corner of the site. Moving it re-joins the road to a station or road end within 1.5 m.',
  'route.end':
    'Where the road ends, in metres from the south-west corner of the site. Moving it re-joins the road to a station or road end within 1.5 m.',
  'route.angle':
    'The direction from the start to the end of the road in degrees. 0° points east (right on the map), 90° points north (up).',
  'route.twoWay':
    'On: a lane for each direction, robots keep right. Off: robots can only drive the road one way, from start to end.',
  'route.heading':
    'Sets the direction the robot faces when it uses this road. Saved with the road; robots do not use it yet.',
  'route.length': 'Length of the road along its centre line.',
  'route.lanes': 'The lanes this road is made of. A lane carries traffic in one direction only.',

  // zones
  'zone.type': 'What this zone does to the robots inside it.',
  'zone.shape': 'Line gate: a thin gate across a road. Box gate: a rectangle around an area.',
  'zone.field.capacity':
    'How many robots may be inside at the same time. The next one waits at the entrance until there is room.',
  'zone.field.value': 'The setting for this zone type. The list of settings per type is still to come.',
  'zone.corners': 'The corner points that outline the zone on the map.',
  'zone.field.reason': 'Why robots must stay out. Shown to the people who work with the map.',
  'gate.line': 'A thin gate across a road. Robots wait at it until the gate has room.',
  'gate.box': 'A rectangle. Robots wait outside it until it has room.',
} as const;

export type HelpKey = keyof typeof HELP;
/** The tooltip text of a key (nothing when it has none: a missing line never breaks a form). */
export const helpText = (key: string): string | undefined => (HELP as Record<string, string>)[key];
/** Spread onto a label-carrying component (`Input`, `Select`, `Label`, `NumberInput`): `<Input label="…" {...help('station.id')} />`. */
export const help = (key: HelpKey | string): { tooltip?: string } => {
  const t = helpText(key);
  return t ? { tooltip: t } : {};
};

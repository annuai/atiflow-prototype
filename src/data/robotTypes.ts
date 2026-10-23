import sherpaXtLite from '@/assets/robots/sherpa-xt-lite.svg';
import palletMover from '@/assets/robots/pallet-mover.svg';
import placeholder from '@/assets/robots/placeholder.svg';
import flexFork from '@/assets/robots/sherpa-flex-fork.svg';
import flexTug from '@/assets/robots/sherpa-flex-tug.svg';

/**
 * THE catalog of robot types. Every place that shows or needs a robot type reads it from here: the Sherpa Type choices of the Robots page, the
 * illustrations, the Live Floor's 3D model, the robot window. `id` is also the `model` key of the telemetry and of the 3D registry
 * (`engine/robotMesh.ts`, which adds the footprint and the .glb); `label` is what is stored in a robot's `sherpaType` field.
 * A new robot type = one entry here, one illustration in `src/assets/robots/`, one .glb in `public/models/robots/`.
 */
export type RobotTypeId =
  | 'sherpa-xt-lite'
  | 'pallet-mover'
  | 'sherpa-tug-1-5t'
  | 'sherpa-tug-5t'
  | 'sherpa-xt'
  | 'sherpa-tug'
  | 'sherpa-lite'
  | 'sherpa-flex-fork'
  | 'sherpa-flex-tug'
  | 'sherpa-lifter-1t'
  | 'sherpa-lifter-500';
export interface RobotType {
  id: RobotTypeId;
  label: string;
  /** No 3D model yet (the generic 3D body is used) and possibly no picture yet (the placeholder is shown). PLACEHOLDER until the files are added. */ placeholder?: boolean;
  /** Side-view illustration (SVG url). */ illustration: string;
  /** Battery capacity in kWh (PLACEHOLDER values: replace with the data sheet), to turn battery % into energy. */ batteryKWh: number;
  /** What the robot can do at a station (PLACEHOLDER until the data sheets are in: see `CAPABILITIES`). */ capabilities: RobotCapabilities;
}
/**
 * What a robot type can do. The map only says what a station asks for; whether the robot does it is robot configuration (a station that asks for a three-point turn gets an in-place turn
 * from a robot that cannot). `maneuvers` = the park / unpark maneuvers it can drive (ids of the Map Editor's maneuver list); `minTurnRadius` in metres.
 */
export interface RobotCapabilities {
  threePointTurn: boolean;
  /** detects the load before picking it (the pallet robots): a pick stops in front of the load */
  detectsPayload: boolean;
  minTurnRadius: number;
  maneuvers: readonly string[];
  /** the maneuver a station that names none gets (`[control.dynamic_router] default_parking_maneuver`) */
  defaultManeuver: string;
}
const ALL_MANEUVERS = [
  'one_shot_turn',
  'inplace',
  'lanechange',
  'reverse_lanechange',
  'three_point_turn',
  'three_point_lanechange',
] as const;
/** PLACEHOLDER capabilities (from the walkthrough and the autonomy call: tugs and XT do three-point turns, pallet robots turn in place and detect the pallet); replace with the data sheets. */
const CAPABILITIES: Record<RobotTypeId, RobotCapabilities> = {
  'sherpa-xt-lite': {
    threePointTurn: true,
    detectsPayload: false,
    minTurnRadius: 1.2,
    maneuvers: ALL_MANEUVERS,
    defaultManeuver: 'one_shot_turn',
  },
  'pallet-mover': {
    threePointTurn: false,
    detectsPayload: true,
    minTurnRadius: 0.8,
    maneuvers: ['one_shot_turn', 'inplace', 'lanechange', 'reverse_lanechange'],
    defaultManeuver: 'one_shot_turn',
  },
  'sherpa-tug-1-5t': {
    threePointTurn: true,
    detectsPayload: false,
    minTurnRadius: 1.5,
    maneuvers: ALL_MANEUVERS,
    defaultManeuver: 'one_shot_turn',
  },
  'sherpa-tug-5t': {
    threePointTurn: true,
    detectsPayload: false,
    minTurnRadius: 2,
    maneuvers: ALL_MANEUVERS,
    defaultManeuver: 'one_shot_turn',
  },
  'sherpa-xt': {
    threePointTurn: true,
    detectsPayload: false,
    minTurnRadius: 1.5,
    maneuvers: ALL_MANEUVERS,
    defaultManeuver: 'one_shot_turn',
  },
  'sherpa-tug': {
    threePointTurn: true,
    detectsPayload: false,
    minTurnRadius: 1.5,
    maneuvers: ALL_MANEUVERS,
    defaultManeuver: 'one_shot_turn',
  },
  'sherpa-lite': {
    threePointTurn: false,
    detectsPayload: false,
    minTurnRadius: 1,
    maneuvers: ['one_shot_turn', 'inplace'],
    defaultManeuver: 'one_shot_turn',
  },
  'sherpa-flex-fork': {
    threePointTurn: false,
    detectsPayload: true,
    minTurnRadius: 1,
    maneuvers: ['one_shot_turn', 'inplace', 'lanechange', 'reverse_lanechange'],
    defaultManeuver: 'one_shot_turn',
  },
  'sherpa-flex-tug': {
    threePointTurn: true,
    detectsPayload: false,
    minTurnRadius: 1.5,
    maneuvers: ALL_MANEUVERS,
    defaultManeuver: 'one_shot_turn',
  },
  'sherpa-lifter-1t': {
    threePointTurn: false,
    detectsPayload: true,
    minTurnRadius: 1,
    maneuvers: ['one_shot_turn', 'inplace'],
    defaultManeuver: 'one_shot_turn',
  },
  'sherpa-lifter-500': {
    threePointTurn: false,
    detectsPayload: true,
    minTurnRadius: 1,
    maneuvers: ['one_shot_turn', 'inplace'],
    defaultManeuver: 'one_shot_turn',
  },
};

/** Pictures that have arrived (the rest show the placeholder); a new picture = drop the SVG in the folder and add it here. Files are `src/assets/robots/<id>.svg`. */
const ILLUSTRATION: Partial<Record<RobotTypeId, string>> = { 'sherpa-flex-fork': flexFork, 'sherpa-flex-tug': flexTug };

export const ROBOT_TYPES: readonly RobotType[] = [
  {
    id: 'sherpa-xt-lite',
    label: 'Sherpa XT Lite',
    illustration: sherpaXtLite,
    batteryKWh: 2,
    capabilities: CAPABILITIES['sherpa-xt-lite'],
  },
  {
    id: 'pallet-mover',
    label: 'Pallet Mover',
    illustration: palletMover,
    batteryKWh: 4,
    capabilities: CAPABILITIES['pallet-mover'],
  },
  // The rest of the Sherpa range that is in the system today (names from the Deployment Manager). PLACEHOLDER picture, 3D body and battery size until the real ones are added.
  ...(
    [
      ['sherpa-tug-1-5t', 'Sherpa Tug 1.5T'],
      ['sherpa-tug-5t', 'Sherpa Tug 5T'],
      ['sherpa-xt', 'Sherpa XT'],
      ['sherpa-tug', 'Sherpa Tug'],
      ['sherpa-lite', 'Sherpa Lite'],
      ['sherpa-flex-fork', 'Sherpa Flex Fork'],
      ['sherpa-flex-tug', 'Sherpa Flex Tug'],
      ['sherpa-lifter-1t', 'Sherpa Lifter 1T'],
      ['sherpa-lifter-500', 'Sherpa Lifter 500'],
    ] as const
  ).map(([id, label]): RobotType => ({
    id,
    label,
    illustration: ILLUSTRATION[id] ?? placeholder,
    batteryKWh: 3,
    placeholder: true,
    capabilities: CAPABILITIES[id],
  })),
];
/** The type of the robots on our maps; what an unknown type falls back to. */
export const DEFAULT_ROBOT_TYPE = ROBOT_TYPES[0];
export const ROBOT_TYPE_LABELS = ROBOT_TYPES.map((t) => t.label);

export const robotTypeById = (id: string | undefined): RobotType =>
  ROBOT_TYPES.find((t) => t.id === id) ?? DEFAULT_ROBOT_TYPE;
export const robotTypeByLabel = (label: unknown): RobotType =>
  ROBOT_TYPES.find((t) => t.label === label) ?? DEFAULT_ROBOT_TYPE;

/** Auto-hitch and auto un-hitch exist only on these robots (by catalog id). */
const AUTO_HITCH: readonly string[] = ['sherpa-xt-lite', 'sherpa-xt', 'sherpa-tug-5t', 'sherpa-tug-1-5t'];
/** Does the robot type (its stored label) have the auto-hitch add-ons? */
export const hasAutoHitch = (sherpaType: unknown) => AUTO_HITCH.includes(robotTypeByLabel(sherpaType).id);

/** The robot types that can NOT do a three-point turn (they turn on the spot instead). */
export const withoutThreePointTurn = (): RobotType[] => ROBOT_TYPES.filter((t) => !t.capabilities.threePointTurn);

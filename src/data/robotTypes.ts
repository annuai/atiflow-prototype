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
}

/** Pictures that have arrived (the rest show the placeholder); a new picture = drop the SVG in the folder and add it here. Files are `src/assets/robots/<id>.svg`. */
const ILLUSTRATION: Partial<Record<RobotTypeId, string>> = { 'sherpa-flex-fork': flexFork, 'sherpa-flex-tug': flexTug };

export const ROBOT_TYPES: readonly RobotType[] = [
  { id: 'sherpa-xt-lite', label: 'Sherpa XT Lite', illustration: sherpaXtLite, batteryKWh: 2 },
  { id: 'pallet-mover', label: 'Pallet Mover', illustration: palletMover, batteryKWh: 4 },
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
  })),
];
/** The type of the robots on our maps; what an unknown type falls back to. */
export const DEFAULT_ROBOT_TYPE = ROBOT_TYPES[0];
export const ROBOT_TYPE_LABELS = ROBOT_TYPES.map((t) => t.label);

export const robotTypeById = (id: string | undefined): RobotType =>
  ROBOT_TYPES.find((t) => t.id === id) ?? DEFAULT_ROBOT_TYPE;
export const robotTypeByLabel = (label: unknown): RobotType =>
  ROBOT_TYPES.find((t) => t.label === label) ?? DEFAULT_ROBOT_TYPE;

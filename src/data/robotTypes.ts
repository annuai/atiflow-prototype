import sherpaXtLite from '@/assets/robots/sherpa-xt-lite.svg';
import palletMover from '@/assets/robots/pallet-mover.svg';

/**
 * THE catalog of robot types. Every place that shows or needs a robot type reads it from here: the Sherpa Type choices of the Robots page, the
 * illustrations, the Live Floor's 3D model, the robot window. `id` is also the `model` key of the telemetry and of the 3D registry
 * (`engine/robotMesh.ts`, which adds the footprint and the .glb); `label` is what is stored in a robot's `sherpaType` field.
 * A new robot type = one entry here, one illustration in `src/assets/robots/`, one .glb in `public/models/robots/`.
 */
export type RobotTypeId = 'sherpa-xt-lite' | 'pallet-mover';
export interface RobotType { id: RobotTypeId; label: string; /** Side-view illustration (SVG url). */ illustration: string; /** Battery capacity in kWh (PLACEHOLDER values: replace with the data sheet), to turn battery % into energy. */ batteryKWh: number }

export const ROBOT_TYPES: readonly RobotType[] = [
  { id: 'sherpa-xt-lite', label: 'Sherpa XT Lite', illustration: sherpaXtLite, batteryKWh: 2 },
  { id: 'pallet-mover', label: 'Pallet Mover', illustration: palletMover, batteryKWh: 4 },
];
/** The type of the robots on our maps; what an unknown type falls back to. */
export const DEFAULT_ROBOT_TYPE = ROBOT_TYPES[0];
export const ROBOT_TYPE_LABELS = ROBOT_TYPES.map((t) => t.label);

export const robotTypeById = (id: string | undefined): RobotType => ROBOT_TYPES.find((t) => t.id === id) ?? DEFAULT_ROBOT_TYPE;
export const robotTypeByLabel = (label: unknown): RobotType => ROBOT_TYPES.find((t) => t.label === label) ?? DEFAULT_ROBOT_TYPE;

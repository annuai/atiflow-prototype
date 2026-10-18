/**
 * What the robot's service pages (Configuration, Calibration, Software Update) work with. These are the CONTRACT between the screens and whatever supplies the data: the dummy adapter
 * today (`services/dummy/robotOps.ts`), the Fleet Manager's robot API later. Pure types: no React, no storage.
 */

/** Which robot an operation is about. `name` is the robot's unique name (AMR-004); `type` is the catalog id (sherpa-xt-lite). */
export interface RobotRef {
  name: string;
  type: string;
  /** the firmware version the robot reports, when known (the Details page shows the same value) */
  firmware?: string;
}

// ---- configuration -------------------------------------------------------------------------------------------------------------------------------------------------------------
export type ConfigValue = number | boolean | string;
export type ConfigValues = Record<string, ConfigValue>;

interface ParamBase {
  /** The parameter's name in the robot's configuration (what the API uses). */
  key: string;
  label: string;
  /** What it does, in plain words (shown as a tooltip). */
  help?: string;
  /** A group heading inside the category ("Runaway Monitor"). */
  group?: string;
}
export interface NumberParam extends ParamBase {
  kind: 'number';
  min?: number;
  max?: number;
  integer?: boolean;
  unit?: string;
}
interface ToggleParam extends ParamBase {
  kind: 'toggle';
}
interface ChoiceParam extends ParamBase {
  kind: 'choice';
  options: string[];
}
export type ConfigParam = NumberParam | ToggleParam | ChoiceParam;

export interface ConfigCategory {
  id: string;
  label: string;
  params: ConfigParam[];
}
/** The categories and parameters a robot type has, with the default value of each. A real robot reports its own. */
export interface ConfigSchema {
  categories: ConfigCategory[];
  defaults: ConfigValues;
}

// ---- calibration ---------------------------------------------------------------------------------------------------------------------------------------------------------------
export type CalibrationKind = 'sensor' | 'steering';
export interface CalibrationStatus {
  kind: CalibrationKind;
  /** epoch ms of the last successful run, null = never calibrated */
  lastRunAt: number | null;
  /** a run is in progress */
  running: boolean;
}

// ---- software ------------------------------------------------------------------------------------------------------------------------------------------------------------------
export interface UpdateRecord {
  version: string;
  /** epoch ms */
  at: number;
  notes: string;
  result: 'success' | 'failed';
}
export interface SoftwareStatus {
  /** the version on the robot, null when unknown */
  installed: string | null;
  /** the newest version on offer */
  latest: string;
  /** epoch ms of the last check for updates, null = never */
  lastCheckedAt: number | null;
  /** epoch ms of the last successful update, null = never */
  lastUpdatedAt: number | null;
  /** newest first */
  history: UpdateRecord[];
  installing: boolean;
}

// ---- the port ------------------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Everything the robot service pages ask of the outside world. Every call is asynchronous and may fail (the promise rejects with an Error whose message can be shown to the person).
 * `services().robotOps` is the instance; a real adapter implements the same shape over the Fleet Manager's robot endpoints.
 */
export interface RobotOpsService {
  config: {
    schema(robot: RobotRef): Promise<ConfigSchema>;
    get(robot: RobotRef): Promise<ConfigValues>;
    /** Saves the whole set of values; resolves with what the robot now has. */
    save(robot: RobotRef, values: ConfigValues): Promise<ConfigValues>;
    /** Back to the factory defaults (instead of a version history: one step back to a known good state). */
    restoreDefaults(robot: RobotRef): Promise<ConfigValues>;
  };
  calibration: {
    list(robot: RobotRef): Promise<CalibrationStatus[]>;
    /** Runs the calibration and resolves when it is done. Rejects when the robot cannot do it now (offline, driving...). */
    run(robot: RobotRef, kind: CalibrationKind): Promise<CalibrationStatus>;
  };
  software: {
    status(robot: RobotRef): Promise<SoftwareStatus>;
    checkForUpdates(robot: RobotRef): Promise<SoftwareStatus>;
    /** Sends the newest version to the robot and installs it. Resolves with the new status. */
    install(robot: RobotRef): Promise<SoftwareStatus>;
  };
}

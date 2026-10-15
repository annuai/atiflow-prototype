import {
  CALIBRATION_KINDS,
  CONFIG_SCHEMA,
  FIRMWARE_HISTORY,
  LATEST_FIRMWARE,
  calibrationSeed,
} from '@/fixtures/robotOps';
import type {
  CalibrationKind,
  CalibrationStatus,
  ConfigValues,
  RobotOpsService,
  RobotRef,
  SoftwareStatus,
} from '@/features/robot-ops/model/types';
import type { RobotOpsDocument, RobotOpsStateService } from '../ports';

export interface RobotOpsOptions {
  /** how long a request takes (a network round trip); tests use 0 */
  latencyMs?: number;
  /** how long a calibration or an update takes; tests use 0 */
  workMs?: number;
  now?: () => number;
}

/**
 * DUMMY robot service: the configuration, calibration and firmware state of each robot, kept in browser storage and seeded from `fixtures/robotOps.ts`. It behaves like a robot would
 * (asynchronous, takes time, can refuse) so the screens already handle loading, progress and errors; the Fleet Manager adapter replaces it without the screens noticing.
 */
export function createDummyRobotOps(state: RobotOpsStateService, opts: RobotOpsOptions = {}): RobotOpsService {
  const { latencyMs = 0, workMs = 0, now = Date.now } = opts;
  const wait = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());
  const doc = (): RobotOpsDocument => state.read() ?? {};
  const patch = async (robot: RobotRef, change: RobotOpsDocument[string]) => {
    await state.save({ ...doc(), [robot.name]: { ...doc()[robot.name], ...change } });
  };
  const running = new Set<string>(); // `${robot}:${what}` in progress in this session

  const config = (robot: RobotRef): ConfigValues => ({ ...CONFIG_SCHEMA.defaults, ...doc()[robot.name]?.config });
  const calibrationOf = (robot: RobotRef): CalibrationStatus[] => {
    const saved = doc()[robot.name]?.calibration;
    const seed = calibrationSeed(now());
    return CALIBRATION_KINDS.map((kind) => ({
      kind,
      lastRunAt: saved && kind in saved ? (saved[kind] ?? null) : seed[kind],
      running: running.has(`${robot.name}:${kind}`),
    }));
  };
  const software = (robot: RobotRef): SoftwareStatus => {
    const s = doc()[robot.name]?.software;
    return {
      installed: s
        ? s.installed
        : robot.firmware && robot.firmware !== '—'
          ? robot.firmware
          : FIRMWARE_HISTORY[0].version,
      latest: LATEST_FIRMWARE,
      lastCheckedAt: s ? s.lastCheckedAt : now(),
      lastUpdatedAt: s ? s.lastUpdatedAt : FIRMWARE_HISTORY[0].at,
      history: s ? s.history : FIRMWARE_HISTORY,
      installing: running.has(`${robot.name}:install`),
    };
  };

  return {
    config: {
      async schema() {
        await wait(latencyMs);
        return structuredClone(CONFIG_SCHEMA);
      },
      async get(robot) {
        await wait(latencyMs);
        return config(robot);
      },
      async save(robot, values) {
        await wait(latencyMs);
        await patch(robot, { config: { ...values } });
        return config(robot);
      },
      async restoreDefaults(robot) {
        await wait(latencyMs);
        await patch(robot, { config: { ...CONFIG_SCHEMA.defaults } });
        return config(robot);
      },
    },
    calibration: {
      async list(robot) {
        await wait(latencyMs);
        return calibrationOf(robot);
      },
      async run(robot, kind: CalibrationKind) {
        const id = `${robot.name}:${kind}`;
        if (running.has(id)) throw new Error('This calibration is already running.');
        running.add(id);
        try {
          await wait(latencyMs + workMs);
          await patch(robot, { calibration: { ...doc()[robot.name]?.calibration, [kind]: now() } });
        } finally {
          running.delete(id);
        }
        return calibrationOf(robot).find((c) => c.kind === kind)!;
      },
    },
    software: {
      async status(robot) {
        await wait(latencyMs);
        return software(robot);
      },
      async checkForUpdates(robot) {
        await wait(latencyMs);
        const cur = software(robot);
        await patch(robot, {
          software: {
            installed: cur.installed,
            lastCheckedAt: now(),
            lastUpdatedAt: cur.lastUpdatedAt,
            history: cur.history,
          },
        });
        return software(robot);
      },
      async install(robot) {
        const id = `${robot.name}:install`;
        const cur = software(robot);
        if (cur.installed === cur.latest) throw new Error('The robot already has the newest version.');
        if (running.has(id)) throw new Error('An update is already being installed.');
        running.add(id);
        try {
          await wait(latencyMs + workMs);
          const at = now();
          await patch(robot, {
            software: {
              installed: cur.latest,
              lastCheckedAt: cur.lastCheckedAt ?? at,
              lastUpdatedAt: at,
              history: [
                { version: cur.latest, at, notes: `Updated to ${cur.latest}.`, result: 'success' },
                ...cur.history,
              ],
            },
          });
        } finally {
          running.delete(id);
        }
        return software(robot);
      },
    },
  };
}

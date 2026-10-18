import { t } from '../text';
import { formatDate } from '@/i18n';

/** Recorded drive sessions of a robot that a map can be generated from. */
export interface RunData {
  id: string;
  label: string;
}
/** Where run data comes from. Swap the implementation for the robot / fleet manager API; the UI only knows this interface. */
export interface RunDataSource {
  forRobot(robot: string): Promise<RunData[]>;
}

const LATENCY_MS = 250;
const DAY = 86_400_000;
/** MOCK: three recent sessions per robot, generated from the robot name (no real recordings exist in the prototype). */
export const mockRunData: RunDataSource = {
  forRobot: (robot) =>
    new Promise((resolve) =>
      setTimeout(
        () =>
          resolve(
            [0, 1, 2].map((k) => ({
              id: `${robot}-run-${k + 1}`,
              label: t.maps.session(robot, formatDate(Date.now() - (k + 1) * DAY, 'day'), 3 - k),
            })),
          ),
        LATENCY_MS,
      ),
    ),
};

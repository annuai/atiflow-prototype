import type { CalibrationKind, ConfigSchema, UpdateRecord } from '@/features/robot-ops/model/types';

/**
 * Starting data of the DUMMY robot service. PLACEHOLDER content: the real list of configuration categories and parameters comes from the robot's software (the design notes ask which
 * parameter belongs under which heading, and what each one means: only the Safety > Runaway Monitor pair is from the design; the rest are plausible examples to fill the screens).
 */
export const CONFIG_SCHEMA: ConfigSchema = {
  categories: [
    {
      id: 'safety',
      label: 'Safety',
      params: [
        {
          key: 'max_exception_events',
          label: 'Max Exception Events',
          group: 'Runaway Monitor',
          kind: 'number',
          integer: true,
          min: 1,
          max: 100,
          help: 'How many exception events the runaway monitor tolerates before it stops the robot.',
        },
        {
          key: 'divergence_score_window_length',
          label: 'Divergence Score Window Length',
          group: 'Runaway Monitor',
          kind: 'number',
          integer: true,
          min: 10,
          max: 1000,
          help: 'How many recent samples the runaway monitor averages when it scores how far the robot has drifted from its path.',
        },
      ],
    },
    {
      id: 'audio',
      label: 'Audio',
      params: [
        { key: 'horn_volume', label: 'Horn Volume', kind: 'number', integer: true, min: 0, max: 100, unit: '%' },
        { key: 'beep_when_reversing', label: 'Beep When Reversing', kind: 'toggle' },
      ],
    },
    {
      id: 'battery',
      label: 'Battery',
      params: [
        {
          key: 'low_battery_threshold',
          label: 'Low Battery Threshold',
          kind: 'number',
          integer: true,
          min: 5,
          max: 50,
          unit: '%',
          help: 'Below this charge the robot goes to a charger.',
        },
        { key: 'charge_target', label: 'Charge Target', kind: 'number', integer: true, min: 50, max: 100, unit: '%' },
      ],
    },
    { id: 'yelli', label: 'Yelli', params: [] },
    {
      id: 'vehicle',
      label: 'Vehicle',
      params: [{ key: 'max_speed', label: 'Max Speed', kind: 'number', min: 0.1, max: 2, unit: 'm/s' }],
    },
    {
      id: 'perception',
      label: 'Perception',
      params: [
        { key: 'obstacle_stop_distance', label: 'Obstacle Stop Distance', kind: 'number', min: 0.2, max: 3, unit: 'm' },
        { key: 'lidar_mode', label: 'Lidar Mode', kind: 'choice', options: ['Standard', 'High range', 'Low power'] },
      ],
    },
    { id: 'control', label: 'Control', params: [] },
    { id: 'peripherals', label: 'Peripherals', params: [] },
    { id: 'advanced', label: 'Advanced Settings', params: [] },
  ],
  defaults: {
    max_exception_events: 15,
    divergence_score_window_length: 100,
    horn_volume: 70,
    beep_when_reversing: true,
    low_battery_threshold: 25,
    charge_target: 90,
    max_speed: 1.2,
    obstacle_stop_distance: 0.8,
    lidar_mode: 'Standard',
  },
};

export const CALIBRATION_KINDS: CalibrationKind[] = ['sensor', 'steering'];
const DAY = 86_400_000;
/** The sensor calibration was done 120 days ago and the steering was never calibrated (as in the design). */
export const calibrationSeed = (now: number): Record<CalibrationKind, number | null> => ({
  sensor: now - 120 * DAY,
  steering: null,
});

/** The newest version on offer (as in the design), and the update history every robot starts with. */
export const LATEST_FIRMWARE = 'v3.2.2';
export const FIRMWARE_HISTORY: UpdateRecord[] = [
  {
    version: 'v3.2.1',
    at: Date.UTC(2026, 8, 15, 9, 0),
    notes: 'Fixed lidar noise filtering anomalies and battery SOH logging precision.',
    result: 'success',
  },
  {
    version: 'v3.1.0',
    at: Date.UTC(2026, 6, 22, 9, 0),
    notes: 'Added dynamic speed limits inside tight safety zones.',
    result: 'success',
  },
  {
    version: 'v3.0.2',
    at: Date.UTC(2026, 4, 10, 9, 0),
    notes: 'Enhanced orchestrator mission scheduling latency.',
    result: 'success',
  },
];

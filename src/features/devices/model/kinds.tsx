import { Camera01, StopSquare, Truck01, VolumeMax } from '@untitledui/icons';
import type { Device, DeviceKind, FieldDef } from './types';
import DATASET from '@/data/dataset.json';
import { ROBOT_TYPE_LABELS, robotTypeByLabel } from '@/data/robotTypes';

/** Hardware type -> icon. The Figma file only has a placeholder square for these (annotation: "need appropriate icons"), so these are Untitled icons. */
export const HARDWARE_ICONS = { 'Summon Button': StopSquare, Hooter: VolumeMax, 'Ati Eye': Camera01 } as const;
const hwIcon = (type: string) => HARDWARE_ICONS[type as keyof typeof HARDWARE_ICONS] ?? StopSquare;

const MANUFACTURER = ['Ati Robotics'];
const ADDONS = ['Auto-Hitch', 'Auto Un-hitch'];
const HARDWARE_TYPES = Object.keys(HARDWARE_ICONS);
const FLEET: FieldDef = { key: 'fleet', label: 'Assigned Fleet', control: 'fleet', detail: { editable: true } };

const ROBOT_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Robot Name', control: 'text', placeholder: 'e.g. Sherpa-09', required: true, unique: true, modal: 'full', detailOrder: 1, detail: true },
  { key: 'manufacturer', label: 'Manufacturer', control: 'select', options: MANUFACTURER, required: true, modal: 'full', detailOrder: 3, detail: true },
  { key: 'sherpaType', label: 'Sherpa Type', control: 'select', options: ROBOT_TYPE_LABELS, required: true, tag: 'Ati Exclusive', modal: 'full', detailOrder: 5, detail: { label: 'Type of Robot', display: 'badge', editable: true } },
  { key: 'hardwareId', label: 'Hardware ID', control: 'text', placeholder: 'HW-XXXX-XX', required: true, unique: true, modal: 'half', detailOrder: 2, detail: true },
  { key: 'apiKey', label: 'API Key', control: 'secret', placeholder: 'flow_api_••••••••', required: true, modal: 'half', detailOrder: 4, detail: { editable: true } },
  { key: 'addons', label: 'Hardware Add-ons', control: 'checks', options: ADDONS, modal: 'full', detailOrder: 6, detail: { display: 'badges', editable: true } },
  { key: 'ip', label: 'IP Address', control: 'text', initial: '—', detail: true },
  { key: 'firmware', label: 'Firmware Version', control: 'text', initial: '—', detail: true },
  { key: 'lastCalibration', label: 'Last Calibration', control: 'text', initial: '—', detail: true },
  FLEET,
];
const HARDWARE_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Hardware Name', control: 'text', placeholder: 'e.g. Line-01 Summon Button', required: true, unique: true, modal: 'full', detailOrder: 1, detail: true },
  { key: 'manufacturer', label: 'Manufacturer', control: 'select', options: MANUFACTURER, required: true, modal: 'full', detailOrder: 3, detail: true },
  { key: 'hwType', label: 'Hardware Type', control: 'select', options: HARDWARE_TYPES, required: true, modal: 'full', detailOrder: 5, detail: { label: 'Type of Hardware', display: 'badge' } },
  { key: 'hardwareId', label: 'Hardware ID', control: 'text', placeholder: 'HW-XXXX-XX', required: true, unique: true, modal: 'half', detailOrder: 2, detail: true },
  { key: 'apiKey', label: 'API Key', control: 'secret', placeholder: 'flow_api_••••••••', required: true, modal: 'half', detailOrder: 4, detail: { editable: true } },
  FLEET,
];

/** The side-view illustration of the robot's type (src/assets/robots). Without a robot (empty state) the default type is shown. */
const robotPicture = (cls: string, sherpaType?: unknown) => { const t = robotTypeByLabel(sherpaType); return <img src={t.illustration} alt={t.label} className={cls} />; };
const hardwarePicture = (type: string, cls: string) => { const I = hwIcon(type); return <I className={cls} />; };

export const KINDS: Record<'robot' | 'hardware', DeviceKind> = {
  robot: {
    id: 'robot', route: 'robots', singular: 'Robot', plural: 'Robots',
    subtitle: 'Add, configure, or remove robots', addLabel: 'Add Robot', addSubtitle: 'Register a new autonomous mobile robot to your fleet operations.',
    columns: { name: 'Robot Name', type: 'Robot Type' },
    detail: { heading: 'Robot Specifications & Metadata', description: 'Basic configuration parameters for the robot', tabs: ['Details', 'Configuration', 'Calibration', 'Software Update'] },
    fields: ROBOT_FIELDS, icon: Truck01,
    typeOf: (d) => robotTypeByLabel(d.values.sherpaType).label, headerBadges: (d) => [robotTypeByLabel(d.values.sherpaType).label],
    thumb: (d) => robotPicture('h-16 w-24 object-contain', d.values.sherpaType),
    illustration: (d) => robotPicture('h-full max-h-[134px] w-[240px] object-contain', d.values.sherpaType),
    preview: (v) => ({ image: robotPicture('h-[137px] w-[160px] object-contain', v.sherpaType), caption: robotTypeByLabel(v.sherpaType).label }),
    empty: { headline: 'Let’s add your first robot!', description: 'Register your AMRs to start assigning them to fleets, maps and workflows.', hint: 'Keep the Hardware ID and API key from the robot’s label handy.' },
    seed: DATASET.robot as Device[],
  },
  hardware: {
    id: 'hardware', route: 'hardware', singular: 'Hardware', plural: 'Hardware',
    subtitle: 'Add new hardware and configure them', addLabel: 'Add Hardware', addSubtitle: 'Register a new hardware device to enhance operations',
    columns: { name: 'Hardware Name', type: 'Hardware Type' },
    detail: { heading: 'Configuration', description: 'Basic configuration parameters for the hardware' },
    fields: HARDWARE_FIELDS, icon: StopSquare,
    typeOf: (d) => String(d.values.hwType), headerBadges: (d) => [String(d.values.hwType)],
    thumb: (d) => <span className="grid place-items-center rounded-[20px] bg-tertiary px-6 py-3">{hardwarePicture(String(d.values.hwType), 'size-9 text-secondary')}</span>,
    illustration: (d) => <span className="grid size-[102px] place-items-center rounded-3xl border-2 border-secondary text-secondary">{hardwarePicture(String(d.values.hwType), 'size-12')}</span>,
    preview: (v) => ({ heading: 'HARDWARE PREVIEW', image: hardwarePicture(String(v.hwType), 'size-[102px] text-secondary'), caption: String(v.hwType) }),
    empty: {
      headline: 'Let’s connect your hardware!', description: 'Add hardware devices like Summon Buttons, Hooters, Ati Eye etc. here.', prompt: 'What device do you want to start with?',
      quickPicks: HARDWARE_TYPES.map((t) => ({ label: t, value: t, icon: HARDWARE_ICONS[t as keyof typeof HARDWARE_ICONS] })),
    },
    seed: DATASET.hardware as Device[],
  },
};

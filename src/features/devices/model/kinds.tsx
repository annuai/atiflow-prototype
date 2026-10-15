import { Camera01, StopSquare, Truck01, VolumeMax } from '@untitledui/icons';
import type { Device, DeviceKind, FieldDef } from './types';
import DATASET from '@/fixtures/dataset.json';
import { ROBOT_TYPE_LABELS, robotTypeByLabel } from '@/data/robotTypes';
import { t } from '../text';

/** Hardware type -> icon. The Figma file only has a placeholder square for these (annotation: "need appropriate icons"), so these are Untitled icons. */
export const HARDWARE_ICONS = { 'Summon Button': StopSquare, Hooter: VolumeMax, 'Ati Eye': Camera01 } as const;
const hwIcon = (type: string) => HARDWARE_ICONS[type as keyof typeof HARDWARE_ICONS] ?? StopSquare;

const MANUFACTURER = ['Ati Robotics'];
const ADDONS = ['Auto-Hitch', 'Auto Un-hitch'];
const HARDWARE_TYPES = Object.keys(HARDWARE_ICONS);
const FLEET: FieldDef = {
  key: 'fleet',
  get label() {
    return t.fields.fleet;
  },
  control: 'fleet',
  detail: { editable: true },
};

const ROBOT_FIELDS: FieldDef[] = [
  {
    key: 'name',
    get label() {
      return t.fields.robotName;
    },
    control: 'text',
    get placeholder() {
      return t.placeholders.robotName;
    },
    required: true,
    unique: true,
    modal: 'full',
    detailOrder: 1,
    detail: true,
  },
  {
    key: 'manufacturer',
    get label() {
      return t.fields.manufacturer;
    },
    control: 'select',
    options: MANUFACTURER,
    required: true,
    modal: 'full',
    detailOrder: 3,
    detail: true,
  },
  {
    key: 'sherpaType',
    get label() {
      return t.fields.sherpaType;
    },
    control: 'select',
    options: ROBOT_TYPE_LABELS,
    required: true,
    get tag() {
      return t.fields.exclusiveTag;
    },
    modal: 'full',
    detailOrder: 5,
    detail: {
      get label() {
        return t.fields.typeOfRobot;
      },
      display: 'badge',
      editable: true,
    },
  },
  {
    key: 'hardwareId',
    get label() {
      return t.fields.hardwareId;
    },
    control: 'text',
    placeholder: 'HW-XXXX-XX',
    required: true,
    unique: true,
    modal: 'half',
    detailOrder: 2,
    detail: true,
  },
  {
    key: 'apiKey',
    get label() {
      return t.fields.apiKey;
    },
    control: 'secret',
    placeholder: 'flow_api_••••••••',
    required: true,
    modal: 'half',
    detailOrder: 4,
    detail: { editable: true },
  },
  {
    key: 'addons',
    get label() {
      return t.fields.addons;
    },
    control: 'checks',
    options: ADDONS,
    modal: 'full',
    detailOrder: 6,
    detail: { display: 'badges', editable: true },
  },
  {
    key: 'ip',
    get label() {
      return t.fields.ip;
    },
    control: 'text',
    initial: '—',
    detail: true,
  },
  {
    key: 'firmware',
    get label() {
      return t.fields.firmware;
    },
    control: 'text',
    initial: '—',
    detail: true,
  },
  {
    key: 'lastCalibration',
    get label() {
      return t.fields.lastCalibration;
    },
    control: 'text',
    initial: '—',
    detail: true,
  },
  FLEET,
];
const HARDWARE_FIELDS: FieldDef[] = [
  {
    key: 'name',
    get label() {
      return t.fields.hardwareName;
    },
    control: 'text',
    get placeholder() {
      return t.placeholders.hardwareName;
    },
    required: true,
    unique: true,
    modal: 'full',
    detailOrder: 1,
    detail: true,
  },
  {
    key: 'manufacturer',
    get label() {
      return t.fields.manufacturer;
    },
    control: 'select',
    options: MANUFACTURER,
    required: true,
    modal: 'full',
    detailOrder: 3,
    detail: true,
  },
  {
    key: 'hwType',
    get label() {
      return t.fields.hwType;
    },
    control: 'select',
    options: HARDWARE_TYPES,
    required: true,
    modal: 'full',
    detailOrder: 5,
    detail: {
      get label() {
        return t.fields.typeOfHardware;
      },
      display: 'badge',
    },
  },
  {
    key: 'hardwareId',
    get label() {
      return t.fields.hardwareId;
    },
    control: 'text',
    placeholder: 'HW-XXXX-XX',
    required: true,
    unique: true,
    modal: 'half',
    detailOrder: 2,
    detail: true,
  },
  {
    key: 'apiKey',
    get label() {
      return t.fields.apiKey;
    },
    control: 'secret',
    placeholder: 'flow_api_••••••••',
    required: true,
    modal: 'half',
    detailOrder: 4,
    detail: { editable: true },
  },
  FLEET,
];

/** The side-view illustration of the robot's type (src/assets/robots). Without a robot (empty state) the default type is shown. */
const robotPicture = (cls: string, sherpaType?: unknown) => {
  const t = robotTypeByLabel(sherpaType);
  return <img src={t.illustration} alt={t.label} className={cls} />;
};
const hardwarePicture = (type: string, cls: string) => {
  const I = hwIcon(type);
  return <I className={cls} />;
};

export const KINDS: Record<'robot' | 'hardware', DeviceKind> = {
  robot: {
    id: 'robot',
    route: 'robots',
    get singular() {
      return t.kinds.robot.singular;
    },
    get plural() {
      return t.kinds.robot.plural;
    },
    get subtitle() {
      return t.kinds.robot.subtitle;
    },
    get addLabel() {
      return t.kinds.robot.addLabel;
    },
    get addSubtitle() {
      return t.kinds.robot.addSubtitle;
    },
    columns: {
      get name() {
        return t.kinds.robot.columns.name;
      },
      get type() {
        return t.kinds.robot.columns.type;
      },
    },
    detail: {
      get heading() {
        return t.kinds.robot.detailHeading;
      },
      get description() {
        return t.kinds.robot.detailDescription;
      },
      tabs: ['Details', 'Configuration', 'Calibration', 'Software Update'],
    },
    fields: ROBOT_FIELDS,
    icon: Truck01,
    typeOf: (d) => robotTypeByLabel(d.values.sherpaType).label,
    headerBadges: (d) => [robotTypeByLabel(d.values.sherpaType).label],
    thumb: (d) => robotPicture('h-16 w-24 object-contain', d.values.sherpaType),
    illustration: (d) => robotPicture('h-full max-h-[96px] w-[200px] object-contain', d.values.sherpaType),
    preview: (v) => ({
      image: robotPicture('h-[137px] w-[160px] object-contain', v.sherpaType),
      caption: robotTypeByLabel(v.sherpaType).label,
    }),
    empty: {
      get headline() {
        return t.kinds.robot.empty.headline;
      },
      get description() {
        return t.kinds.robot.empty.description;
      },
      get hint() {
        return t.kinds.robot.empty.hint;
      },
    },
    seed: DATASET.robot as Device[],
  },
  hardware: {
    id: 'hardware',
    route: 'hardware',
    get singular() {
      return t.kinds.hardware.singular;
    },
    get plural() {
      return t.kinds.hardware.plural;
    },
    get subtitle() {
      return t.kinds.hardware.subtitle;
    },
    get addLabel() {
      return t.kinds.hardware.addLabel;
    },
    get addSubtitle() {
      return t.kinds.hardware.addSubtitle;
    },
    columns: {
      get name() {
        return t.kinds.hardware.columns.name;
      },
      get type() {
        return t.kinds.hardware.columns.type;
      },
    },
    detail: {
      get heading() {
        return t.kinds.hardware.detailHeading;
      },
      get description() {
        return t.kinds.hardware.detailDescription;
      },
    },
    fields: HARDWARE_FIELDS,
    icon: StopSquare,
    typeOf: (d) => String(d.values.hwType),
    headerBadges: (d) => [String(d.values.hwType)],
    thumb: (d) => (
      <span className="grid place-items-center rounded-[20px] bg-tertiary px-6 py-3">
        {hardwarePicture(String(d.values.hwType), 'size-9 text-secondary')}
      </span>
    ),
    illustration: (d) => (
      <span className="grid size-[96px] place-items-center rounded-3xl border-2 border-secondary text-secondary">
        {hardwarePicture(String(d.values.hwType), 'size-12')}
      </span>
    ),
    preview: (v) => ({
      heading: t.kinds.hardware.previewHeading,
      image: hardwarePicture(String(v.hwType), 'size-[102px] text-secondary'),
      caption: String(v.hwType),
    }),
    empty: {
      get headline() {
        return t.kinds.hardware.empty.headline;
      },
      get description() {
        return t.kinds.hardware.empty.description;
      },
      get prompt() {
        return t.kinds.hardware.empty.prompt;
      },

      quickPicks: HARDWARE_TYPES.map((t) => ({
        label: t,
        value: t,
        icon: HARDWARE_ICONS[t as keyof typeof HARDWARE_ICONS],
      })),
    },
    seed: DATASET.hardware as Device[],
  },
};

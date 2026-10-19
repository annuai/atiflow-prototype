import { FLEET_ID } from '../src/data/fleets';
import { describe, expect, it } from 'vitest';
import { KINDS } from '../src/features/devices/model/kinds';
import {
  blankValues,
  findDevice,
  nameOf,
  shownFields,
  validateNew,
  withoutHidden,
} from '../src/features/devices/model/validate';

const { robot, hardware } = KINDS;
const filled = (kind: typeof robot, over: Record<string, string> = {}) => ({
  ...blankValues(kind),
  name: 'Sherpa-09',
  hardwareId: 'HW-1234-09',
  apiKey: 'flow_api_x',
  ...over,
});

describe('device registry (robots + hardware share one model)', () => {
  it('seeds: 19 robots spread over two fleets (one unassigned), 4 hardware items', () => {
    expect(robot.seed).toHaveLength(19);
    expect(hardware.seed).toHaveLength(4);
    expect(robot.seed.filter((d) => d.values.fleet === FLEET_ID.lineSide)).toHaveLength(9);
    expect(robot.seed.filter((d) => d.values.fleet === '')).toHaveLength(1);
    expect(robot.seed.filter((d) => d.values.fleet).every((d) => d.status === 'online')).toBe(true);
    expect(hardware.seed.map((d) => d.values.hwType)).toEqual(['Summon Button', 'Hooter', 'Ati Eye', 'Hooter']);
  });
  it('seed names and hardware ids are unique', () => {
    for (const k of [robot, hardware]) {
      const names = k.seed.map(nameOf);
      expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
      expect(new Set(k.seed.map((d) => d.values.hardwareId)).size).toBe(k.seed.length);
    }
  });
  it('a valid new robot has no errors', () => expect(validateNew(robot, filled(robot), robot.seed)).toEqual({}));
  it('required fields are enforced', () => {
    const e = validateNew(robot, filled(robot, { name: '  ', hardwareId: '', apiKey: '' }), robot.seed);
    expect(Object.keys(e).sort()).toEqual(['apiKey', 'hardwareId', 'name']);
  });
  it('names and hardware ids must be unique, ignoring case', () => {
    const e = validateNew(robot, filled(robot, { name: 'amr-001', hardwareId: 'hw-2024-amr-0844' }), robot.seed);
    expect(e.name).toMatch(/already registered/);
    expect(e.hardwareId).toMatch(/already registered/);
  });
  it('hardware modal asks for type but not robot-only fields', () => {
    expect(validateNew(hardware, filled(hardware, { name: 'Line 9 Hooter', hwType: 'Hooter' }), hardware.seed)).toEqual(
      {},
    );
    expect(hardware.fields.filter((f) => f.modal).map((f) => f.key)).toEqual([
      'name',
      'manufacturer',
      'hwType',
      'hardwareId',
      'apiKey',
    ]);
  });
  it('blankValues: fresh robots are unassigned with unknown connection details', () => {
    const v = blankValues(robot);
    expect(v.fleet).toBe('');
    expect(v.ip).toBe('—');
    expect(v.addons).toEqual([]);
    expect(v.sherpaType).toBe('Sherpa XT Lite');
  });
  it('presets (empty-state quick picks) override defaults', () =>
    expect(blankValues(hardware, { hwType: 'Ati Eye' }).hwType).toBe('Ati Eye'));
  it('findDevice ignores case', () => expect(nameOf(findDevice(robot.seed, 'amr-004')!)).toBe('AMR-004'));
});

describe('shared dataset', () => {
  it('one document with the fleets and devices; the fleet of every device exists in the fleet list (by id)', async () => {
    const { datasetStore, datasetDoc } = await import('../src/data/dataset');
    const d = datasetStore.getState();
    const ids = d.fleets.map((f) => f.id);
    for (const dev of [...d.robot, ...d.hardware]) if (dev.values.fleet) expect(ids).toContain(dev.values.fleet);
    expect(
      datasetDoc.parse(datasetDoc.exportText({ version: 1, fleets: d.fleets, robot: d.robot, hardware: d.hardware })),
    ).toHaveProperty('value');
    expect(datasetDoc.parse('{"x":1}')).toHaveProperty('error');
    expect(datasetDoc.parse('nope')).toHaveProperty('error');
  });
  it('the Live Floor roster comes from it: assigned, not offline, one entry per robot, every fleet present', async () => {
    const { rosterFrom } = await import('../src/features/live-floor/liveFeed');
    const nav = JSON.parse((await import('node:fs')).readFileSync('public/sites/ecc/nav.json', 'utf8'));
    const r = rosterFrom(nav);
    expect(r).toHaveLength(18);
    expect(new Set(r.map((x) => x.id)).size).toBe(18);
    expect(r.map((x) => x.id)).not.toContain('AMR-015');
    expect(new Set(r.map((x) => x.fleetId))).toEqual(new Set(['line-side', 'asrs']));
  });
});

describe('the next robot name', () => {
  const robot = (name: string) => ({ status: 'online', values: { name } }) as never;
  it('is the next AMR number after the highest in use, padded like the others', async () => {
    const { suggestName } = await import('../src/features/devices/model/validate');
    const { KINDS } = await import('../src/features/devices/model/kinds');
    expect(suggestName(KINDS.robot, [robot('AMR-001'), robot('AMR-019'), robot('AMR-007')])).toBe('AMR-020');
    expect(suggestName(KINDS.robot, [])).toBe('AMR-001');
    expect(suggestName(KINDS.robot, [robot('Sherpa-09'), robot('AMR-004')])).toBe('AMR-005'); // other names are ignored
    expect(suggestName(KINDS.robot, [robot('AMR-0099')])).toBe('AMR-0100'); // keeps a wider number width
    expect(suggestName(KINDS.hardware, [])).toBeNull(); // hardware has no scheme
  });
});

describe('auto-hitch add-ons belong to three robot types', () => {
  const names = (type: string) => shownFields(robot, { sherpaType: type }).map((f) => f.key);
  it('are asked for only on Sherpa XT Lite, Tug 5T and Tug 1.5T', () => {
    for (const t of ['Sherpa XT Lite', 'Sherpa Tug 5T', 'Sherpa Tug 1.5T']) expect(names(t)).toContain('addons');
    for (const t of ['Pallet Mover', 'Sherpa Lifter 1T', 'Sherpa Flex Fork']) expect(names(t)).not.toContain('addons');
  });
  it('are cleared from a record whose type has none', () => {
    expect(withoutHidden(robot, { sherpaType: 'Pallet Mover', addons: ['Auto-Hitch'] }).addons).toEqual([]);
    expect(withoutHidden(robot, { sherpaType: 'Sherpa XT Lite', addons: ['Auto-Hitch'] }).addons).toEqual([
      'Auto-Hitch',
    ]);
  });
});

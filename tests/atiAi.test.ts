import { describe, expect, it } from 'vitest';
import { findInSentence, matchStations, squash } from '../src/features/ati-ai/service/fuzzy';
import { MockAtiAiService } from '../src/features/ati-ai/service/mockService';
import { applyAll, parseWorkflow, validate } from '../src/features/ati-ai/service/configurator';
import type { AiEvent, Block, Context, Role } from '../src/features/ati-ai/types';

const stations = [
  { id: 'STA-105', name: 'Assembly Workstation 1' },
  { id: 'STA-113', name: 'SMT OVER-L3' },
  { id: 'STA-116', name: 'VStore - ASRS 1' },
];
function ctx(over: Partial<Context> = {}): Context & { booked: unknown[] } {
  const booked: unknown[] = [];
  return {
    booked,
    user: { username: 'rohan', name: 'Rohan' },
    fleet: { id: 'line-side', name: 'Line Side Fleet' },
    stations,
    robots: [
      {
        id: 'AMR-003',
        model: 'sherpa-xt-lite',
        label: 'Sherpa XT Lite',
        battery: 80,
        state: 'idle',
        doing: 'parked',
        free: true,
      },
    ],
    trips: [],
    range: '7d',
    booking: null,
    workflow: null,
    now: 0,
    actions: {
      bookTrip: (a) => (booked.push(a), { tripId: 'TRP-001', bookingId: 'BKG-0001' }),
      cancelTrip: () => true,
      callSupervisor: () => {},
    },
    ...over,
  };
}
async function ask(role: Role, i: { text?: string; actionId?: string; payload?: Record<string, string> }, c: Context) {
  const out: { blocks: Block[]; patches: AiEvent[] } = { blocks: [], patches: [] };
  for await (const e of new MockAtiAiService([0, 0]).sendMessage({ role, context: c, ...i }))
    if (e.type === 'block') out.blocks.push(e.block);
    else out.patches.push(e);
  return out;
}

describe('station names are matched loosely', () => {
  it('"line three", "L3" and "line 3" are the same place', () => {
    expect(squash('Line three')).toBe(squash('L3'));
    expect(matchStations('line three', stations)[0]?.id).toBe('STA-113');
    expect(matchStations('l3', stations)[0]?.id).toBe('STA-113');
    expect(matchStations('113', stations)[0]?.id).toBe('STA-113');
    expect(matchStations('workstation 1', stations)[0]?.id).toBe('STA-105');
  });
  it('finds a place anywhere in a sentence and nothing in nonsense', () => {
    expect(findInSentence('send a cart to line three', stations, /\bto\s+(.+)$/)[0]?.id).toBe('STA-113');
    expect(findInSentence('hello there', stations)).toEqual([]);
  });
});

describe('the assistant never changes anything before a confirmation', () => {
  it('a typed booking only shows a confirmation card; Confirm books it', async () => {
    const c = ctx();
    const r = await ask('operator', { text: 'send a cart from workstation 1 to line three' }, c);
    const card = r.blocks.find((b) => b.type === 'confirmation_card');
    expect(card).toBeTruthy();
    expect(c.booked).toEqual([]);
    const done = await ask(
      'operator',
      { actionId: 'confirm', payload: { action: JSON.stringify((card as { action: unknown }).action) } },
      c,
    );
    expect(c.booked).toHaveLength(1);
    expect(JSON.stringify(done.blocks)).toContain('TRP-001');
  });
  it('the guided flow keeps its draft step by step', async () => {
    const c = ctx();
    const a = await ask('operator', { actionId: 'book:start' }, c);
    expect(a.blocks.some((b) => b.type === 'chips')).toBe(true);
    const b = await ask('operator', { actionId: 'pick', payload: { id: 'STA-105' } }, ctx({ booking: {} }));
    expect(b.patches[0]).toMatchObject({ patch: { booking: { from: 'STA-105' } } });
  });
  it('an unknown question gets a friendly answer with suggestions, never a dead end', async () => {
    for (const role of ['operator', 'supervisor', 'configurator'] as Role[]) {
      const r = await ask(role, { text: 'blah blah' }, ctx());
      expect(r.blocks.some((b) => b.type === 'chips')).toBe(true);
    }
  });
});

describe('supervisor and configurator answers', () => {
  it('the shift summary has KPI tiles, a chart and a suggested action', async () => {
    const r = await ask('supervisor', { text: "Summarize today's shift" }, ctx());
    const types = r.blocks.map((b) => b.type);
    expect(types).toEqual(expect.arrayContaining(['kpi_tiles', 'chart', 'actions']));
    expect(JSON.stringify(r.blocks)).toContain('Suggested action');
  });
  it('a described workflow becomes a draft with checks, and the fixes make it pass', () => {
    const w = parseWorkflow('When a cart arrives at Station A, wait for operator confirm, then go to Station B');
    expect(w.steps.map((s) => s.kind)).toEqual(['trigger', 'wait', 'action']);
    expect(validate(w).length).toBeGreaterThan(0);
    expect(validate(applyAll(w))).toEqual([]);
  });
  it('adding a wait asks first, then changes the draft', async () => {
    const r = await ask('configurator', { text: 'Add a 30s wait before step 2' }, ctx());
    expect(r.blocks[0].type).toBe('confirmation_card');
  });
});

// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { runEgg, useEgg } from '@/features/delight/eggs';
import { copy } from '@/features/delight/copy';

beforeAll(() => {
  window.matchMedia ??= (() => ({ matches: false })) as unknown as typeof window.matchMedia;
});
const reset = () => useEgg.setState({ items: [] });

describe('easter eggs', () => {
  it('ignores ordinary searches', () => {
    reset();
    expect(runEgg('AMR-007')).toBe(false);
    expect(useEgg.getState().items).toHaveLength(0);
  });
  it('knows every secret word, in any case', () => {
    for (const w of [
      'robottt',
      'PARTY',
      'confetti',
      'fleet',
      'charge',
      'zap',
      'dance',
      'coffee',
      'hello',
      'namaste',
      'beep',
    ]) {
      reset();
      expect(runEgg(` ${w} `)).toBe(true);
      expect(useEgg.getState().items.length).toBeGreaterThan(0);
    }
  });
  it('sends the kind messages one after the other and starts over', () => {
    reset();
    const n = copy.robot.length;
    for (let i = 0; i < n + 1; i++) runEgg('robottt');
    const texts = useEgg.getState().items.flatMap((x) => (x.kind === 'robot' && x.text ? [x.text] : []));
    const last = texts.slice(-(n + 1));
    last
      .slice(1)
      .forEach((t, k) => expect(copy.robot.indexOf(t as never)).toBe((copy.robot.indexOf(last[k] as never) + 1) % n));
    expect(last[n]).toBe(last[0]);
  });
  it('a fleet is several robots with the ribbon on the last one', () => {
    reset();
    runEgg('fleet');
    const robots = useEgg.getState().items.filter((x) => x.kind === 'robot');
    expect(robots.length).toBeGreaterThan(2);
    expect(robots.filter((r) => r.kind === 'robot' && r.text)).toHaveLength(1);
  });
});

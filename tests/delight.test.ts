// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { authStore } from '@/features/auth';
import { claimMorning, greeting, resetMessages, runEgg, useEgg } from '@/features/delight/eggs';
import { copy } from '@/features/delight/copy';
import { setServices } from '@/services';
import { createDummyServices } from '@/services/dummy';
import { memoryStorage } from './helpers/memoryStorage';

beforeAll(() => {
  setServices(createDummyServices({ backend: memoryStorage().backend }));
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
  it('sends every kind message once, in a shuffled order, before any repeats', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 23, 14, 0)); // afternoon: the once-a-morning rule does not apply
    authStore.setState({ user: { firstName: 'Arjun' } } as never);
    reset();
    resetMessages();
    const n = copy.robot.length + 1;
    for (let i = 0; i < 2 * n; i++) runEgg('robottt');
    expect(useEgg.getState().items).toHaveLength(1); // the rest wait their turn
    const texts: string[] = [];
    for (let i = 0; i < 2 * n; i++) {
      const [r] = useEgg.getState().items;
      texts.push(r.kind === 'robot' ? (r.text ?? '') : '');
      reset(); // that robot has left: the next one starts
    }
    // every message once before any is repeated, and again in the second round (a fresh shuffle)
    expect(new Set(texts.slice(0, n)).size).toBe(n);
    expect(new Set(texts.slice(n)).size).toBe(n);
    expect(texts[n]).not.toBe(texts[n - 1]);
    expect(texts.filter((t) => t.includes('Arjun'))).toHaveLength(2);
    vi.useRealTimers();
  });
  it('the morning greeting is shown once a day, however it is asked for', () => {
    expect(claimMorning('arjun-test', new Date(2031, 0, 5, 8))).toBe(true);
    expect(claimMorning('arjun-test', new Date(2031, 0, 5, 9))).toBe(false);
    expect(claimMorning('arjun-test', new Date(2031, 0, 6, 8))).toBe(true);
    expect(claimMorning('', new Date(2031, 0, 7, 8))).toBe(false);
  });
  it('greets by the time of day and the first name', () => {
    authStore.setState({ user: { firstName: 'Arjun' } } as never);
    expect(greeting(8)).toBe('Good morning, Arjun!');
    expect(greeting(13)).toBe('Good afternoon, Arjun!');
    expect(greeting(20)).toBe('Good evening, Arjun!');
    authStore.setState({ user: null } as never);
    expect(greeting(8)).toBeNull();
  });
  it('robots never share the stage', () => {
    reset();
    runEgg('hello');
    runEgg('coffee');
    expect(useEgg.getState().items).toHaveLength(1);
    reset();
    expect(useEgg.getState().items).toHaveLength(1);
    reset();
  });
  it('a fleet is several robots with the ribbon on the last one', () => {
    reset();
    runEgg('fleet');
    const robots = useEgg.getState().items.filter((x) => x.kind === 'robot');
    expect(robots.length).toBeGreaterThan(2);
    expect(robots.filter((r) => r.kind === 'robot' && r.text)).toHaveLength(1);
  });
});

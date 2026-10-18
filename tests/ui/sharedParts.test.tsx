// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { StatusDot } from '../../src/components/data/StatusDot';
import { useSearchText } from '../../src/hooks/use-search-text';
import { installDomShims } from '../helpers/dom';

installDomShims();
afterEach(cleanup);

describe('useSearchText', () => {
  it('everything matches while nothing is typed; then a row matches when any field has the words, ignoring case and outer spaces', () => {
    const { result } = renderHook(() => useSearchText());
    expect(result.current.matches('AMR-001')).toBe(true);
    act(() => result.current.setText('  amr-0 '));
    expect(result.current.text).toBe('  amr-0 '); // what is typed is kept as typed
    expect(result.current.matches('AMR-001', 'Line Side')).toBe(true);
    expect(result.current.matches('Line Side', 'AMR-002')).toBe(true); // any field
    expect(result.current.matches('Pallet Mover', undefined, null)).toBe(false);
    act(() => result.current.setText(''));
    expect(result.current.matches('anything')).toBe(true);
  });
});

describe('StatusDot', () => {
  it('is hidden from screen readers unless it is the only thing that says something', () => {
    const { container } = render(
      <>
        <StatusDot tone="success" />
        <StatusDot color="#ff0000" size="sm" />
        <StatusDot tone="brand" label="3 changed" />
      </>,
    );
    const dots = container.querySelectorAll('i');
    expect(dots[0].getAttribute('aria-hidden')).toBe('true');
    expect(dots[0].className).toContain('bg-success-solid');
    expect((dots[1] as HTMLElement).style.background).toBe('rgb(255, 0, 0)');
    expect(dots[1].className).toContain('size-1.5');
    expect(dots[2].getAttribute('role')).toBe('img');
    expect(dots[2].getAttribute('aria-label')).toBe('3 changed');
  });
});

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });
describe('shared parts are used', () => {
  it('no screen draws its own status dot', () => {
    const allowed = [
      'components/base',
      'components/application',
      'AssignMapModal',
      'MethodStep',
      'support/components/parts',
    ];
    const offenders = walk('src')
      .filter((f) => !allowed.some((a) => f.includes(a)))
      .filter((f) => /size-(2|1\.5) rounded-full/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
  it('no list filters by hand-made search state (text + trim + lowercase)', () => {
    const offenders = walk('src/features')
      .filter((f) => /useState\(''\)[\s\S]{0,200}\.trim\(\)\.toLowerCase\(\)/.test(readFileSync(f, 'utf8')))
      .filter((f) => !/ApiStep|LocateBox|SearchPalette|Thread|AiPromptBar|Composer/.test(f));
    expect(offenders).toEqual([]);
  });
});

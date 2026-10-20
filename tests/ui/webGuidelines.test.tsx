// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { UnsavedGuard } from '../../src/components/modal/UnsavedGuard';
import { useQueryParam } from '../../src/hooks/use-query-param';
import { rangeFromParams, rangeToParams } from '../../src/features/reports/model/rangeUrl';
import { focusFirstError } from '../../src/utils/focus-first-error';
import { installDomShims } from '../helpers/dom';

installDomShims();
afterEach(cleanup);

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}

describe('tabs and filters live in the address', () => {
  function Tabs() {
    const [tab, setTab] = useQueryParam('tab', 'all', ['all', 'unread']);
    return (
      <>
        <button onClick={() => setTab('unread')}>unread</button>
        <button onClick={() => setTab('all')}>all</button>
        <output data-testid="tab">{tab}</output>
        <Where />
      </>
    );
  }
  it('writes the choice, drops the default, and ignores a value that is not allowed', () => {
    render(
      <MemoryRouter initialEntries={['/p?x=1']}>
        <Tabs />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('unread'));
    expect(screen.getByTestId('where').textContent).toBe('/p?x=1&tab=unread'); // other parameters are kept
    expect(screen.getByTestId('tab').textContent).toBe('unread');
    fireEvent.click(screen.getByText('all'));
    expect(screen.getByTestId('where').textContent).toBe('/p?x=1');
  });
  it('an edited link with an unknown value shows the default', () => {
    render(
      <MemoryRouter initialEntries={['/p?tab=nonsense']}>
        <Tabs />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('tab').textContent).toBe('all');
  });
  it('the report period round-trips through the address', () => {
    expect(rangeToParams({ preset: 'today' })).toEqual({});
    expect(rangeFromParams(new URLSearchParams(''))).toEqual({ preset: 'today' });
    expect(rangeFromParams(new URLSearchParams(rangeToParams({ preset: '30d' })))).toEqual({ preset: '30d' });
    const custom = { preset: 'custom' as const, from: new Date(2026, 9, 1), to: new Date(2026, 9, 7) };
    expect(rangeToParams(custom)).toEqual({ range: 'custom', from: '2026-10-01', to: '2026-10-07' });
    expect(rangeFromParams(new URLSearchParams(rangeToParams(custom)))).toEqual(custom);
    expect(rangeFromParams(new URLSearchParams('range=custom&from=junk'))).toEqual({ preset: '7d' });
  });
});

describe('leaving a form with unsaved changes', () => {
  function Page({ dirty }: { dirty: boolean }) {
    const go = useNavigate();
    return (
      <>
        <UnsavedGuard dirty={dirty} />
        <button onClick={() => go('/elsewhere')}>leave</button>
        <Where />
      </>
    );
  }
  it('asks first while there are edits; "Keep editing" stays, "Discard changes" leaves', async () => {
    render(
      <MemoryRouter initialEntries={['/form']}>
        <Page dirty />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('leave'));
    expect(await screen.findByText('Leave without saving?')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe('/form');
    fireEvent.click(screen.getByText('Keep editing'));
    expect(screen.getByTestId('where').textContent).toBe('/form');
    fireEvent.click(screen.getByText('leave'));
    fireEvent.click(await screen.findByText('Discard changes'));
    expect(screen.getByTestId('where').textContent).toBe('/elsewhere');
  });
  it('lets go straight away when nothing was changed', () => {
    render(
      <MemoryRouter initialEntries={['/form']}>
        <Page dirty={false} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('leave'));
    expect(screen.getByTestId('where').textContent).toBe('/elsewhere');
  });
});

describe('a failed submit', () => {
  it('moves focus to the first invalid field', async () => {
    render(
      <form>
        <input aria-label="a" />
        <input aria-label="b" aria-invalid="true" />
        <input aria-label="c" aria-invalid="true" />
      </form>,
    );
    focusFirstError();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(document.activeElement).toBe(screen.getByLabelText('b'));
  });
});

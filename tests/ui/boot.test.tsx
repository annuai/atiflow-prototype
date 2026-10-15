// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { persistence } from '../../src/data/persist';
import { BootFailure } from '../../src/shell/BootFailure';
import { PersistenceNotice } from '../../src/shell/PersistenceNotice';
import { AppToaster } from '../../src/ui/toast';
import { installDomShims } from '../helpers/dom';

installDomShims();
afterEach(() => {
  cleanup();
  persistence.setState({ failed: {} });
});

describe('start-up failure screen', () => {
  it('names what could not be loaded and offers to try again, instead of starting the app on empty data', async () => {
    const user = userEvent.setup();
    let tries = 0;
    render(<BootFailure failed={['workflows', 'master data']} onRetry={() => tries++} />);
    expect(screen.getByText(/could not load your data/i)).toBeTruthy();
    expect(screen.getByText(/workflows, master data/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Try again/ }));
    expect(tries).toBe(1);
  });
});

describe('unsaved changes notice', () => {
  it('tells the person once when a save has given up, and again only after it recovered and failed anew', async () => {
    render(
      <>
        <AppToaster />
        <PersistenceNotice />
      </>,
    );
    act(() => persistence.setState({ failed: { workflows: 'Server unreachable.' } }));
    expect(await screen.findByText(/changes to workflows were not saved/i)).toBeTruthy();
    act(() => persistence.setState({ failed: { workflows: 'Server unreachable.', settings: 'Timed out.' } }));
    expect(await screen.findByText(/changes to settings were not saved/i)).toBeTruthy();
    expect(screen.getAllByText(/were not saved/i)).toHaveLength(2); // the first one is not announced a second time
  });
});

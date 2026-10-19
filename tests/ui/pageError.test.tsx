// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { supportStore } from '../../src/features/support';
import { PageErrorBoundary } from '../../src/shell/PageErrorBoundary';
import { installDomShims } from '../helpers/dom';

installDomShims();
afterEach(cleanup);

function Broken(): never {
  throw new Error('boom');
}

describe('a page that fails to draw', () => {
  it('points to a support ticket, and the button opens the support window on a new ticket', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined); // React logs the error it catches
    supportStore.getState().setOpen(false);
    render(
      <PageErrorBoundary>
        <Broken />
      </PageErrorBoundary>,
    );
    expect(screen.getByText(/start a support ticket\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start a support ticket' }));
    expect(supportStore.getState().open).toBe(true);
    expect(supportStore.getState().view).toBe('new');
  });
});

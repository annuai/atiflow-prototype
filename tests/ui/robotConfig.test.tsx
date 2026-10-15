// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigurationTab } from '../../src/features/robot-ops/components/ConfigurationTab';
import { FactoryReset } from '../../src/features/robot-ops/components/FactoryReset';
import { setServices } from '../../src/services';
import { createDummyServices } from '../../src/services/dummy';
import { installDomShims } from '../helpers/dom';
import { memoryStorage } from '../helpers/memoryStorage';

installDomShims();
const robot = { name: 'AMR-004', type: 'sherpa-xt-lite', firmware: 'v3.2.1' };
afterEach(cleanup);

describe('Configuration tab', () => {
  let ops: ReturnType<typeof createDummyServices>['robotOps'];
  beforeEach(() => {
    const svc = createDummyServices({ backend: memoryStorage().backend });
    ops = svc.robotOps;
    setServices(svc);
  });
  const footer = (f: { editing: boolean; onEdit(): void; onSave(): void; onCancel(): void }) => (
    <div>
      {f.editing ? (
        <>
          <button onClick={f.onSave}>Save</button>
          <button onClick={f.onCancel}>Cancel</button>
        </>
      ) : (
        <button onClick={f.onEdit}>Edit</button>
      )}
    </div>
  );

  it('shows the Safety parameters read-only, checks a value while editing, and saves a good one through the service', async () => {
    const user = userEvent.setup();
    render(<ConfigurationTab robot={robot} renderFooter={footer} />);
    const field = (await screen.findByLabelText(/Max Exception Events/)) as HTMLInputElement;
    expect(field.value).toBe('15');
    expect(field.disabled).toBe(true); // read-only until Edit
    await user.click(screen.getByText('Edit'));
    expect(field.disabled).toBe(false);
    await user.clear(field);
    await user.type(field, '500');
    expect(await screen.findByText(/Must be 100 or less/)).toBeTruthy();
    await user.click(screen.getByText('Save')); // refused while a value is wrong
    expect((await ops.config.get(robot)).max_exception_events).toBe(15);
    await user.clear(field);
    await user.type(field, '20');
    await user.click(screen.getByText('Save'));
    await waitFor(async () => expect((await ops.config.get(robot)).max_exception_events).toBe(20));
  });

  it('keeps Restore factory settings out of sight: no button on the first screen, only under Advanced Settings > Danger zone', async () => {
    const user = userEvent.setup();
    render(<ConfigurationTab robot={robot} renderFooter={footer} />);
    await screen.findByLabelText(/Max Exception Events/);
    expect(screen.queryByText('Restore factory settings')).toBeNull();
    await user.click(screen.getByText('Advanced Settings'));
    expect(screen.queryByText('Restore factory settings')).toBeNull(); // still folded away
    await user.click(screen.getByText('Danger zone'));
    expect(screen.getAllByText('Restore factory settings').length).toBeGreaterThan(0);
  });
});

describe('FactoryReset', () => {
  it('only restores after the robot name has been typed', async () => {
    const user = userEvent.setup();
    let restored = 0;
    render(<FactoryReset robotName="AMR-004" disabled={false} onRestore={() => restored++} />);
    await user.click(screen.getByText('Danger zone'));
    await user.click(screen.getByRole('button', { name: /Restore factory settings/ }));
    const confirm = (await screen.findByRole('button', { name: 'Restore' })) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await user.type(screen.getByPlaceholderText('AMR-004'), 'AMR-00');
    expect(confirm.disabled).toBe(true);
    await user.type(screen.getByPlaceholderText('AMR-004'), '4');
    expect(confirm.disabled).toBe(false);
    await user.click(confirm);
    expect(restored).toBe(1);
  });
  it('cannot be started while the configuration is being edited', async () => {
    const user = userEvent.setup();
    render(<FactoryReset robotName="AMR-004" disabled onRestore={() => {}} />);
    await user.click(screen.getByText('Danger zone'));
    expect((screen.getByRole('button', { name: /Restore factory settings/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

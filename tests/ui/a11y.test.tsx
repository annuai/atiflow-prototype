// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { TabbedPanel } from '../../src/components/data/TabbedPanel';
import { EmptyState } from '../../src/components/data/EmptyState';
import { SearchLg } from '@untitledui/icons';
import { LoginPage } from '../../src/features/auth/LoginPage';
import { CalibrationTab } from '../../src/features/robot-ops/components/CalibrationTab';
import { ConfigurationTab } from '../../src/features/robot-ops/components/ConfigurationTab';
import { SoftwareUpdateTab } from '../../src/features/robot-ops/components/SoftwareUpdateTab';
import { BootFailure } from '../../src/shell/BootFailure';
import { setServices } from '../../src/services';
import { createDummyServices } from '../../src/services/dummy';
import { installDomShims } from '../helpers/dom';
import { memoryStorage } from '../helpers/memoryStorage';

installDomShims();
afterEach(cleanup);
beforeEach(() => setServices(createDummyServices({ backend: memoryStorage().backend })));
const robot = { name: 'AMR-004', type: 'sherpa-xt-lite', firmware: 'v3.2.1' };
// colour contrast needs real layout and colours: jsdom has neither, so it is left to a browser test
const check = async (container: HTMLElement) => axe(container, { rules: { 'color-contrast': { enabled: false } } });
const none = (r: Awaited<ReturnType<typeof axe>>) => r.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);

describe('accessibility (automated checks that work without a browser)', () => {
  it('the sign-in screen has no violations', async () => {
    const { container } = render(<LoginPage onAuthenticated={() => {}} />);
    expect(none(await check(container))).toEqual([]);
  });
  it('a tabbed area (tabs wired to a tab panel) and a start-up failure screen have none', async () => {
    const { container } = render(
      <>
        <TabbedPanel
          tabs={[
            { id: 'a', label: 'One' },
            { id: 'b', label: 'Two' },
          ]}
          selected="a"
          onSelect={() => {}}
          label="Sections"
        >
          <p>Content of one</p>
        </TabbedPanel>
        <BootFailure failed={['workflows']} onRetry={() => {}} />
        <EmptyState icon={SearchLg} title="Nothing here" subtext="Try again" />
      </>,
    );
    expect(none(await check(container))).toEqual([]);
  });
  it('the robot Configuration, Calibration and Software Update tabs have none', async () => {
    const { container, findByText } = render(
      <MemoryRouter>
        <ConfigurationTab robot={robot} renderFooter={() => <button type="button">Edit</button>} />
        <CalibrationTab robot={robot} online />
        <SoftwareUpdateTab robot={robot} online />
      </MemoryRouter>,
    );
    await findByText('Update History');
    await screen.findAllByText('Sensor Calibration');
    expect(none(await check(container))).toEqual([]);
  });
});

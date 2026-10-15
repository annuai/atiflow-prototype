// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnimatePresence, motion } from 'motion/react';
import { Tabs } from '../../src/components/application/tabs/tabs';
import { TabPanelMotion } from '../../src/components/motion/TabPanelMotion';
import { installDomShims } from '../helpers/dom';

installDomShims();
afterEach(cleanup);

/** jsdom does no layout: give each tab a position from its place in the list, as a browser would. */
const place = (el: HTMLElement) => ['One', 'Two', 'Three'].indexOf((el.textContent ?? '').trim());
Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
  configurable: true,
  get() {
    return place(this) * 100;
  },
});
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  get() {
    return place(this) >= 0 ? 80 : 0;
  },
});

function Demo() {
  const [tab, setTab] = useState('one');
  return (
    <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
      <Tabs.List
        type="underline"
        aria-label="Demo"
        items={[
          { id: 'one', label: 'One' },
          { id: 'two', label: 'Two' },
          { id: 'three', label: 'Three' },
        ]}
      />
      <TabPanelMotion tabKey={tab}>
        <p>content of {tab}</p>
      </TabPanelMotion>
    </Tabs>
  );
}

describe('tab line', () => {
  it('sits under the chosen tab and moves (as CSS variables, no React state) when another is chosen', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const list = screen.getByRole('tablist');
    await new Promise((r) => setTimeout(r, 0));
    expect(list.style.getPropertyValue('--tab-pos')).toBe('0px');
    expect(list.style.getPropertyValue('--tab-size')).toBe('80px');
    await user.click(screen.getByRole('tab', { name: 'Three' }));
    await new Promise((r) => setTimeout(r, 0)); // the observer runs after the DOM change
    expect(list.style.getPropertyValue('--tab-pos')).toBe('200px');
    expect(list.style.getPropertyValue('--tab-ms')).toBe('200ms'); // from the motion tokens
  });
});

describe('TabPanelMotion', () => {
  it('shows the content of the chosen tab and replaces it at once', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    expect(screen.getByText('content of one')).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Two' }));
    expect(screen.queryByText('content of one')).toBeNull();
    expect(screen.getByText('content of two')).toBeTruthy();
  });
  it('does not animate the first tab, but fades in a tab that was chosen later (also inside a page that was entered with initial={false})', async () => {
    const user = userEvent.setup();
    render(
      <AnimatePresence initial={false}>
        <motion.div key="page">
          <Demo />
        </motion.div>
      </AnimatePresence>,
    );
    const panel = () => screen.getByText(/content of/).parentElement as HTMLElement;
    expect(panel().style.opacity).toBe('1'); // already visible on arrival
    await user.click(screen.getByRole('tab', { name: 'Two' }));
    expect(Number(panel().style.opacity)).toBeLessThan(1); // starts transparent and fades in (how far it has got depends on how busy the machine is)
  });
});

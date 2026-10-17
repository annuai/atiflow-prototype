import { useEffect, useRef, type FC, type ReactNode } from 'react';
import { Tabs } from '@/components/application/tabs/tabs';
import { cx } from '@/utils/cx';
import { TabPanelMotion } from '@/components/motion/TabPanelMotion';

export interface TabItem {
  id: string;
  label: string;
  icon?: FC<{ className?: string }>;
  badge?: number | string;
}
interface Props {
  tabs: TabItem[];
  selected: string;
  onSelect(id: string): void;
  /** the accessible name of the tab bar */
  label: string;
  /** classes of the whole tabbed area (default: fills the page card and may shrink below its content, so the card body inside scrolls; a card that scrolls AS A WHOLE must pass `flex-1` without `min-h-0`, otherwise the content overflows the area and the card's bottom padding is lost) */
  rootClassName?: string;
  /** space around the tab bar (default: the page card's) */
  barClassName?: string;
  /** extra classes of the tab list itself (for example `overflow-x-auto` when there are many tabs) */
  listClassName?: string;
  /** the element that holds the chosen tab's content (default: the page card's scrolling body, `md-body`) */
  panelClassName?: string;
  /** the wrapper the content fades in inside (default: it fills the body and lays its children out in a column, like the card body does) */
  contentClassName?: string;
  /** what makes the content "new" for the fade (default: the chosen tab; a page whose data also changes with the URL, such as the fleet, adds that) */
  contentKey?: string;
  children: ReactNode;
}

/**
 * THE tabbed area of the app: an underline tab bar and the content of the chosen tab, wired together as the ARIA tab pattern asks (each tab controls a real tab panel), with the gliding
 * line under the tabs and the fade of the new content. Pages say WHICH tabs there are and render the content of the chosen one as `children`; they carry no tab or animation code.
 * It fills the page card it is placed in (`.builder`); the first child of the card.
 */
export function TabbedPanel({
  tabs,
  selected,
  onSelect,
  label,
  rootClassName = 'min-h-0 flex-1',
  barClassName = 'min-w-0 flex-none px-5 pt-6',
  listClassName,
  panelClassName = 'md-body',
  contentClassName,
  contentKey,
  children,
}: Props) {
  // the chosen tab scrolls into view when the tab bar scrolls sideways (a phone), e.g. when a page opens on its last tab
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bar.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    el?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, [selected]);
  return (
    <Tabs selectedKey={selected} onSelectionChange={(k) => onSelect(String(k))} className={rootClassName}>
      <div ref={bar} className={barClassName}>
        <Tabs.List
          type="underline"
          size="md"
          fullWidth
          className={cx(
            'overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            listClassName,
          )}
          aria-label={label}
          items={tabs}
        />
      </div>
      <Tabs.Panel id={selected} className={panelClassName}>
        <TabPanelMotion tabKey={contentKey ?? selected} fill={!contentClassName} className={contentClassName}>
          {children}
        </TabPanelMotion>
      </Tabs.Panel>
    </Tabs>
  );
}

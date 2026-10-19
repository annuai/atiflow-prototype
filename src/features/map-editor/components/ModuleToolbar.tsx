import type { FC } from 'react';
import {
  Building07,
  ChevronDown,
  Cursor01,
  LayoutGrid01,
  MarkerPin02,
  Route,
  Hand,
  Dotpoints01,
} from '@untitledui/icons';
import { Button as AriaButton } from 'react-aria-components';
import { Dropdown } from '@/components/base/dropdown/dropdown';
import { Tooltip } from '@/components/base/tooltip/tooltip';
import { cx } from '@/utils/cx';
import { choicesOf, moduleOfTool, type Module, type StructureTool, type Tool } from '../canvas/tools';
import { copy } from '../copy';
import { text } from '../text';
import { helpText } from '../help';
import { zoneType } from '../model/zoneTypes';

export type { Module };
const ICON: Record<Module, FC<{ className?: string }>> = {
  stations: MarkerPin02,
  routes: Route,
  exclusive: Hand,
  zones: LayoutGrid01,
  structure: Building07,
};
const MODULES: Module[] = ['stations', 'routes', 'exclusive', 'zones', 'structure'];
/** What a choice is called in the arrow menu. */
const choiceLabel = (m: Module, id: string): string =>
  m === 'stations'
    ? id === 'staging'
      ? copy.stations.createStaging
      : copy.stations.createStation
    : m === 'routes'
      ? id === 'one-way'
        ? copy.routes.oneWayRoad
        : copy.routes.twoWayRoad
      : m === 'exclusive'
        ? id === 'box'
          ? copy.zones.gateBox
          : copy.zones.gateLine
        : m === 'structure'
          ? copy.structure.tools[id as StructureTool]
          : zoneType(id).label;

const tile = (on: boolean) =>
  cx(
    'flex size-10 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg outline-focus-ring transition focus-visible:outline-2 pointer-coarse:h-14 pointer-coarse:w-auto pointer-coarse:min-w-16 pointer-coarse:px-2',
    on ? 'bg-brand-solid text-white' : 'text-secondary hover:bg-primary_hover',
  );

/**
 * The drawing tools as a floating bar at the bottom centre of the map (like Figma's): Select, then Stations, Routes, Traffic Gates and Zones, each with an arrow that lists what it can draw.
 * Clicking a tool makes the next click on the map draw it (with its last choice); the arrow picks another thing to draw. Esc or Select goes back to selecting.
 */
export function ModuleToolbar({
  tool,
  choices,
  onSelect,
  onTool,
  multi,
}: {
  tool: Tool;
  choices: Record<Module, string>;
  onSelect(): void;
  onTool(m: Module, choice: string): void;
  /** the Select multiple switch (shown while the Structure module is open) */
  multi?: { on: boolean; toggle(): void };
}) {
  const active = moduleOfTool(tool);
  return (
    <nav
      className="map-tools absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-2xl bg-primary p-2 shadow-lg ring-1 ring-secondary"
      aria-label={text.aria.tools}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Tooltip title={copy.tools.select} description={helpText('tool.select')} placement="top" delay={500}>
        <AriaButton
          aria-label={copy.tools.select}
          aria-current={tool.kind === 'select'}
          onPress={onSelect}
          className={tile(tool.kind === 'select')}
        >
          <Cursor01 className="size-5" />
          <span className="hidden text-[11px] leading-3 pointer-coarse:block">{copy.tools.select}</span>
        </AriaButton>
      </Tooltip>
      {multi && (
        <Tooltip title={copy.tools.multi} description={helpText('tool.multi')} placement="top" delay={500}>
          <AriaButton
            aria-label={copy.tools.multi}
            aria-pressed={multi.on}
            onPress={multi.toggle}
            className={tile(multi.on)}
          >
            <Dotpoints01 className="size-5" />
            <span className="hidden text-[11px] leading-3 whitespace-nowrap pointer-coarse:block">
              {copy.tools.multi}
            </span>
          </AriaButton>
        </Tooltip>
      )}
      <span className="mx-1 h-6 w-px bg-border-secondary" aria-hidden />
      {MODULES.map((m) => {
        const Icon = ICON[m];
        const on = active === m;
        return (
          <div key={m} className="flex items-center">
            <Tooltip
              title={`${copy.tabs[m]}: ${choiceLabel(m, choices[m])}`}
              description={helpText(`module.${m}`)}
              placement="top"
              delay={500}
            >
              <AriaButton
                aria-label={copy.tabs[m]}
                aria-current={on}
                onPress={() => onTool(m, choices[m])}
                className={tile(on)}
              >
                <Icon className="size-5" />
                <span className="hidden text-[11px] leading-3 whitespace-nowrap pointer-coarse:block">
                  {copy.tabs[m]}
                </span>
              </AriaButton>
            </Tooltip>
            <Dropdown.Root>
              <AriaButton
                aria-label={`${copy.tabs[m]}: ${copy.tools.choose}`}
                className="grid h-10 w-5 cursor-pointer place-items-center rounded-md pointer-coarse:h-14 pointer-coarse:w-9 text-fg-quaternary outline-focus-ring hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2"
              >
                <ChevronDown className="size-3.5" />
              </AriaButton>
              <Dropdown.Popover placement="top" className="max-h-80 w-56">
                <Dropdown.Menu onAction={(k) => onTool(m, String(k))}>
                  {choicesOf(m).map((id) => (
                    <Dropdown.Item key={id} id={id} label={choiceLabel(m, id)} />
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          </div>
        );
      })}
    </nav>
  );
}

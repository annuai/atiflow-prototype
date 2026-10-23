import type { Module } from './tools';

/** The single letter that picks each tool: V select, S stations, R routes, T traffic gates, Z zones, W structure. Shown in the tooltips of the tool bar. */
export const TOOL_KEYS: Record<'select' | Module, string> = {
  select: 'V',
  stations: 'S',
  routes: 'R',
  exclusive: 'T',
  zones: 'Z',
  structure: 'W',
};
/** The tool a letter picks (any case), if any. */
export const toolOfKey = (key: string): 'select' | Module | undefined =>
  (Object.keys(TOOL_KEYS) as ('select' | Module)[]).find((t) => TOOL_KEYS[t] === key.toUpperCase());

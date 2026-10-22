import type { DrawingKind, Rule } from './types';

/**
 * Guesses what a layer or a block is from what it is called and, for blocks, how big it is. CAD offices name things in their own way, so this is a list of words that usually mean something
 * (in English and the common abbreviations), checked in order: noise first (dimensions, notes, hatches), then the structure. Anything unknown is left out of the 3D map and shown in the review
 * table so a person can decide: guessing a wall where there is none is worse than asking.
 */
export interface Guess extends Rule {
  /** why: a key the review table shows as a short reason */
  why: 'noise' | 'name' | 'size' | 'container' | 'unknown';
}

/** Words that start a word in the name; a short word ("col", "lan") must also end it, so "color" is not a column. */
const word = (list: string[]) =>
  new RegExp(`(^|[^a-z])(${list.map((w) => (w.length <= 3 ? `${w}(?![a-z])` : w)).join('|')})`, 'i');
const NOISE = word([
  'dim',
  'dimension',
  'text',
  'note',
  'annot',
  'anno',
  'title',
  'tblock',
  'border',
  'frame',
  'hatch',
  'grid',
  'axis',
  'center',
  'centre',
  'defpoints',
  'viewport',
  'vport',
  'symbol',
  'sym',
  'elev',
  'ceil',
  'light',
  'lamp',
  'power',
  'elec',
  'lan',
  'network',
  'data',
  'pipe',
  'pvc',
  'duct',
  'conduit',
  'cable',
  'hvac',
  'fire',
  'sprink',
  'mep',
  'plumb',
  'sanit',
  'iso',
  'sichtbar',
  'ref',
  'xref',
  'revision',
  'rev',
  'cloud',
  'mark',
  'tag',
  'label',
  'leader',
  'arrow',
  'north',
  'scale',
  'legend',
  'logo',
  'photo',
  'image',
  'furn',
  'chair',
  'desk',
  'person',
  'people',
  'tree',
  'plant',
  'car',
  'vehicle',
  'road',
  'landscape',
  'site',
  'topo',
  'contour',
  'temp',
  'tmp',
  'old',
  'delete',
  'hidden',
  'layer01',
  'diffuser',
  'grill',
  'louver',
  'damper',
  'vent',
  'exhaust',
  'smoke',
  'detector',
  'cctv',
  'camera',
  'speaker',
  'socket',
  'outlet',
  'sprinkler',
  'man',
]);
const WALL = word([
  'wall',
  'wal',
  'a-wall',
  'brick',
  'masonry',
  'concrete',
  'shell',
  'external',
  'outer',
  'envelope',
  'facade',
  'cladding',
  'fab',
]);
const PARTITION = word([
  'partition',
  'panel',
  'glass',
  'glaz',
  'fence',
  'rail',
  'barrier',
  'mesh',
  'guard',
  'screen',
  'cage',
  'divider',
]);
const PILLAR = word(['col', 'column', 'pillar', 'post', 'pier', 'stanchion', 'strut', 'stl-col']);
const DOOR = word(['door', 'dr', 'gate', 'shutter', 'rollup', 'opening', 'entry']);
const MACHINE = word([
  'equip',
  'machine',
  'mach',
  'mc',
  'conveyor',
  'convey',
  'rack',
  'shelf',
  'shelv',
  'tool',
  'line',
  'smt',
  'asrs',
  'press',
  'oven',
  'printer',
  'workstation',
  'work station',
  'ws',
  'bench',
  'table',
  'cabinet',
  'tank',
  'robot',
  'amr',
  'agv',
  'station',
  'unit',
  'fixture',
  'pallet',
  'trolley',
  'cart',
  'lift',
  'crane',
  'feeder',
  'reflow',
  'spi',
  'aoi',
  'vi',
  'test',
  'plant',
  'am_',
]);
const AREA = word([
  'zone',
  'area',
  'room',
  'bay',
  'region',
  'space',
  'boundary',
  'bound',
  'floor',
  'hall',
  'dept',
  'department',
  'cell',
  'section',
  'eec',
]);

/** The kind a layer or block name points to, or null. Noise wins, so "WALL TEXT" is a note, not a wall. */
export function kindFromName(name: string): { kind: DrawingKind; why: Guess['why'] } | null {
  const n = name.trim();
  if (!n || n === '0') return null;
  if (NOISE.test(n) && !MACHINE.test(n)) return { kind: 'ignore', why: 'noise' };
  if (/^(\*|a\$c|\$)/i.test(n)) return null; // anonymous, hashed block names say nothing
  if (DOOR.test(n)) return { kind: 'door', why: 'name' };
  if (PILLAR.test(n)) return { kind: 'pillar', why: 'name' };
  if (/partition/i.test(n)) return { kind: 'partition', why: 'name' };
  if (WALL.test(n)) return { kind: 'wall', why: 'name' }; // "FAB WALL PANEL" is a wall, "GLASS PANEL" is not
  if (PARTITION.test(n)) return { kind: 'partition', why: 'name' };
  if (MACHINE.test(n)) return { kind: 'machine', why: 'name' };
  if (AREA.test(n)) return { kind: 'area', why: 'name' };
  return null;
}

/** The usual height of each kind in metres (partitions lower than walls; names like "conveyor" or "table" lower still). */
export const KIND_HEIGHT: Record<DrawingKind, number> = {
  wall: 4,
  partition: 1.6,
  machine: 1.8,
  pillar: 4,
  door: 2.2,
  area: 0,
  explode: 0,
  ignore: 0,
};
const LOW = /conveyor|convey|bench|table|workstation|work station|\bws\b|cart|trolley|pallet|desk|cabinet/i;
const TALL = /rack|asrs|shelf|shelv|tank|oven|reflow|crane|press|printer/i;
/** A height for a machine from its name; others use their kind's height. */
export function heightFor(kind: DrawingKind, name: string): number {
  if (kind !== 'machine') return KIND_HEIGHT[kind];
  if (LOW.test(name)) return 0.9;
  if (TALL.test(name)) return 2.6;
  return KIND_HEIGHT.machine;
}

export function guessLayer(name: string): Guess {
  const k = kindFromName(name);
  if (k && k.kind === 'door') return { kind: 'ignore', why: 'unknown' }; // doors are blocks; a layer of door lines has no opening to cut
  if (k) return { kind: k.kind, why: k.why };
  return { kind: 'ignore', why: 'unknown' };
}

/** A block: by name first; otherwise by size (a block as big as the building is a container, a small one is a machine, a speck is nothing). `w` and `d` are in metres. */
export function guessBlock(name: string, w: number, d: number, shapes: number): Guess {
  const k = kindFromName(name);
  if (k && k.kind !== 'area') return { kind: k.kind, why: k.why };
  const big = Math.max(w, d),
    small = Math.min(w, d);
  if (big > 40 || shapes > 3000) return { kind: 'explode', why: 'container' };
  if (big < 0.12) return { kind: 'ignore', why: 'size' };
  if (big <= 0.9 && small >= 0.2 && big / Math.max(small, 0.01) <= 1.6 && shapes <= 40)
    return { kind: 'pillar', why: 'size' };
  if (big >= 0.4 && big <= 40 && small >= 0.15) return { kind: 'machine', why: 'size' }; // thinner than 15 cm is a line symbol, not a machine
  return { kind: 'ignore', why: 'unknown' };
}

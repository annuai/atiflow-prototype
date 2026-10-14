import type { IconId, NodeTypeId, NodeTypeSpec } from './types';

/**
 * THE extension point: a node type is one entry here (fields, colours, defaults). Cards, palette, parser and simulator read this registry.
 * Colours are the Figma node accents.
 */
export const NODE_TYPES: Record<NodeTypeId, NodeTypeSpec> = {
  start: { label: 'Start Node', accent: '#e1f5ee', icon: 'play', w: 280, fixed: true, fields: [
    { key: 'trigger', label: 'Start Trigger', opts: ['Manual', 'Auto', 'Scheduled'] },
    { key: 'robot', label: 'Robot Type', opts: ['Sherpa XT Lite', 'Sherpa XT', 'Sherpa Hitch'] },
    { key: 'request', label: 'Request Type', opts: ['Request from Tablet', 'MES', 'Tablet', 'Call Button'] },
    { key: 'user', label: 'User ID', kind: 'multi', opts: ['USER-001', 'USER-002', 'USER-003', 'USER-004'] }] },
  material: { label: 'Material', accent: '#eedcef', icon: 'keyframes', w: 224, defaults: { type: 'Material', code: '', fromTablet: false, qty: '10' }, fields: [
    { key: 'type', label: 'Type', opts: ['Material', 'Kit', 'Spare Part'] },
    { key: 'code', label: 'Code', optsFrom: 'fleetMaterials' },
    { key: 'fromTablet', label: 'Select quantity from Tablet', kind: 'check' },
    { key: 'qty', label: 'Quantity', kind: 'input' }] },
  logic: { label: 'If Logic', accent: '#d5dbfd', icon: 'keyframes', w: 245, defaults: { material: '', station: '', cond: 'Greater than', qty: '10' }, fields: [
    { key: 'material', label: 'Material', optsFrom: 'fleetMaterials' },
    { key: 'station', label: 'Station', optsFrom: 'fleetStations' },
    { key: 'cond', label: 'CONDITION', kind: 'cond', opts: ['Greater than', 'Less than', 'Equal to', 'Not equal to'] },
    { key: 'qty', label: 'Quantity', row: true, opts: ['5', '10', '20', '50', '100'] }] },
  container: { label: 'Empty Container', accent: '#d5dbfd', icon: 'box', w: 165, fields: [], note: 'Container will be picked from here without scanning' },
  wait: { label: 'Wait', accent: '#b5def0', icon: 'clock', w: 155, defaults: { time: '00:01:00' }, fields: [
    { key: 'time', label: 'Time', opts: ['00:00:30', '00:01:00', '00:02:00', '00:05:00', '00:10:00'] }] },
  station: { label: 'Station', accent: '#fdf4df', icon: 'pin', w: 155, bw: 170, defaults: { action: 'Pick Up', station: '' }, fields: [
    { key: 'action', label: 'Type', opts: ['Pick Up', 'Drop Off'] },
    { key: 'station', label: (n) => (n.f.lbl as string) || 'Station/ Staging Area', optsFrom: 'fleetStations', branch: { label: 'Station', kind: 'multi' } }] },
  confirm: { label: 'Confirm', accent: '#dcfce7', icon: 'badge', w: 173, defaults: { op: 'Dispatch Button' }, fields: [
    { key: 'op', label: 'Operation', opts: ['Dispatch Button', 'Tablet', 'Barcode Scan', 'Weight Sensor'] }] },
  end: { label: 'End Node', accent: '#f7e4e4', icon: 'square', w: 140, fixed: true, fields: [], note: 'Stops the workflow' },
};

export interface PaletteEntry { type: NodeTypeId | 'aiot'; label: string; accent?: string; icon?: IconId | 'antenna' }
/** Palette order (Figma). `aiot` has only a tile in the design, no node card yet. */
export const PALETTE: PaletteEntry[] = [
  { type: 'material', label: 'Material' }, { type: 'logic', label: 'If Logic' }, { type: 'container', label: 'Empty Container' }, { type: 'wait', label: 'Wait' },
  { type: 'station', label: 'Station' }, { type: 'confirm', label: 'Confirm' }, { type: 'end', label: 'End Node' },
  { type: 'aiot', label: 'AIoT', accent: '#e6e6e6', icon: 'antenna' },
];

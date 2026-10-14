import type { ConnectionDef, ConnectionId } from './types';

/**
 * THE catalog of connections. Everything about one (its name, fields, whether it syncs) is here; the cards, the edit dialog, the status and the test all read it.
 * A new integration = one entry here (plus its starting values in `seed.ts`).
 */
export const CONNECTIONS: ConnectionDef[] = [
  { id: 'fleet-manager', name: 'Fleet Manager', initials: 'FM', color: '#0f9d8a', syncs: true, fields: [
    { key: 'host', label: 'Host address', kind: 'host', placeholder: '192.168.100.31 or fleet.example.com', required: true },
    { key: 'clientId', label: 'Client ID', kind: 'text', placeholder: 'The ID this app signs in with', required: true, group: 'Fleet Manager Credentials' },
    { key: 'clientSecret', label: 'Client secret', kind: 'secret', placeholder: 'The secret that goes with the Client ID', required: true, group: 'Fleet Manager Credentials', hint: 'Kept hidden. Enter a new one to replace it.' }] },
  { id: 'mes', name: 'MES Connections', initials: 'MES', color: '#1d5fc4', syncs: false, fields: [
    { key: 'amrUrl', label: 'AMR URL', kind: 'url', placeholder: 'https://mes.example.com/amr', required: true },
    { key: 'bomUrl', label: 'BOM URL', kind: 'url', placeholder: 'https://mes.example.com/bom', required: true }] },
];
export const connectionById = (id: ConnectionId): ConnectionDef => CONNECTIONS.find((c) => c.id === id)!;

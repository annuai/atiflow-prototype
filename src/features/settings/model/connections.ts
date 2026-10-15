import { localized } from '@/i18n';
import type { ConnectionDef, ConnectionId } from './types';

// text is read through getters: the language can change while the app runs, a module-level copy would stay in the first one
const fm = localized('misc').settings.connections.fleetManager;
const mes = localized('misc').settings.connections.mes;

/**
 * THE catalog of connections. Everything about one (its name, fields, whether it syncs) is here; the cards, the edit dialog, the status and the test all read it.
 * A new integration = one entry here (plus its starting values in `seed.ts`).
 */
export const CONNECTIONS: ConnectionDef[] = [
  {
    id: 'fleet-manager',
    get name() {
      return fm.name;
    },
    initials: 'FM',
    color: '#0f9d8a',
    syncs: true,
    fields: [
      {
        key: 'host',
        get label() {
          return fm.hostAddress;
        },
        kind: 'host',
        get placeholder() {
          return fm.hostPlaceholder;
        },
        required: true,
      },
      {
        key: 'clientId',
        get label() {
          return fm.clientId;
        },
        kind: 'text',
        get placeholder() {
          return fm.clientIdPlaceholder;
        },
        required: true,
        get group() {
          return fm.credentials;
        },
      },
      {
        key: 'clientSecret',
        get label() {
          return fm.clientSecret;
        },
        kind: 'secret',
        get placeholder() {
          return fm.secretPlaceholder;
        },
        required: true,
        get group() {
          return fm.credentials;
        },
        get hint() {
          return fm.secretHint;
        },
      },
    ],
  },
  {
    id: 'mes',
    get name() {
      return mes.name;
    },
    initials: 'MES',
    color: '#1d5fc4',
    syncs: false,
    fields: [
      {
        key: 'amrUrl',
        get label() {
          return mes.amrUrl;
        },
        kind: 'url',
        placeholder: 'https://mes.example.com/amr',
        required: true,
      },
      {
        key: 'bomUrl',
        get label() {
          return mes.bomUrl;
        },
        kind: 'url',
        placeholder: 'https://mes.example.com/bom',
        required: true,
      },
    ],
  },
];
export const connectionById = (id: ConnectionId): ConnectionDef => CONNECTIONS.find((c) => c.id === id)!;

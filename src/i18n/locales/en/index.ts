import { floor } from './floor';
import { workflow } from './workflow';
import { devices } from './devices';
import { misc } from './misc';
import { insights } from './insights';
import { actionCenter } from './actionCenter';
import { bookings } from './bookings';
import { dashboard } from './dashboard';
import { fleets } from './fleets';
import { mapEditor } from './mapEditor';
import { drawingImport } from './drawingImport';
import { maps } from './maps';
import { masterData } from './masterData';
import { notifications } from './notifications';
import { reports } from './reports';
import { requests } from './requests';
import { robotOps } from './robotOps';
import { users } from './users';
import { materials } from './materials';
import { nav } from './nav';
import { onboarding } from './onboarding';
import { auth } from './auth';
import { common } from './common';
import { ai } from './ai';
import { support } from './support';
import { search } from './search';
import { delight } from './delight';
import { approach } from './approach';
import { preferences } from './preferences';
import { settings } from './settings';
import { shell } from './shell';

/** Every area of the interface in English (the master). Add an area here, then in each language's `index.ts`. */
export const catalog = {
  onboarding,
  approach,
  delight,
  common,
  auth,
  shell,
  settings,
  preferences,
  actionCenter,
  bookings,
  dashboard,
  fleets,
  mapEditor,
  drawingImport,
  maps,
  masterData,
  notifications,
  reports,
  requests,
  robotOps,
  users,
  nav,
  materials,
  floor,
  workflow,
  devices,
  misc,
  insights,
  ai,
  support,
  search,
};

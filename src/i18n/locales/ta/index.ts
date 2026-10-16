import type { Catalog } from '../../catalog';
import { messages as actionCenter } from './actionCenter';
import { messages as auth } from './auth';
import { messages as bookings } from './bookings';
import { messages as common } from './common';
import { messages as ai } from './ai';
import { messages as support } from './support';
import { messages as dashboard } from './dashboard';
import { messages as devices } from './devices';
import { messages as fleets } from './fleets';
import { messages as floor } from './floor';
import { messages as insights } from './insights';
import { messages as mapEditor } from './mapEditor';
import { messages as maps } from './maps';
import { messages as masterData } from './masterData';
import { messages as misc } from './misc';
import { messages as materials } from './materials';
import { messages as nav } from './nav';
import { messages as notifications } from './notifications';
import { messages as preferences } from './preferences';
import { messages as reports } from './reports';
import { messages as requests } from './requests';
import { messages as robotOps } from './robotOps';
import { messages as settings } from './settings';
import { messages as shell } from './shell';
import { messages as users } from './users';
import { messages as workflow } from './workflow';

export const catalog: Catalog = {
  ai,
  support,
  actionCenter,
  auth,
  bookings,
  common,
  dashboard,
  devices,
  fleets,
  floor,
  insights,
  mapEditor,
  maps,
  masterData,
  misc,
  nav,
  materials,
  notifications,
  preferences,
  reports,
  requests,
  robotOps,
  settings,
  shell,
  users,
  workflow,
};

import { messages as floor } from './floor';
import { messages as workflow } from './workflow';
import { messages as devices } from './devices';
import { messages as misc } from './misc';
import { messages as insights } from './insights';
import type { Catalog } from '../../catalog';
import { messages as actionCenter } from './actionCenter';
import { messages as auth } from './auth';
import { messages as bookings } from './bookings';
import { messages as common } from './common';
import { messages as dashboard } from './dashboard';
import { messages as fleets } from './fleets';
import { messages as mapEditor } from './mapEditor';
import { messages as maps } from './maps';
import { messages as masterData } from './masterData';
import { messages as nav } from './nav';
import { messages as notifications } from './notifications';
import { messages as preferences } from './preferences';
import { messages as reports } from './reports';
import { messages as requests } from './requests';
import { messages as robotOps } from './robotOps';
import { messages as settings } from './settings';
import { messages as shell } from './shell';
import { messages as users } from './users';

export const catalog: Catalog = {
  actionCenter,
  auth,
  bookings,
  common,
  dashboard,
  fleets,
  mapEditor,
  maps,
  masterData,
  notifications,
  preferences,
  reports,
  requests,
  robotOps,
  settings,
  shell,
  users,
  nav,
  floor,
  workflow,
  devices,
  misc,
  insights,
};

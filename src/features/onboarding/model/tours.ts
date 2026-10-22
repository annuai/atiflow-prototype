import { copy } from '../copy';

/**
 * The walkthroughs, as data. A step points at something on the page by its `data-tour` name (never a CSS class: classes change, these names are put there for this purpose), says which
 * page it lives on, and where its text is. A step whose target is not on the page (the person may not see it, or the thing does not exist yet) is skipped, so nobody is shown a hole.
 */
export type TourId = 'configurator' | 'supervisor' | 'operator';
export interface TourStep {
  id: string;
  /** the page this step is on (the walkthrough goes there first) */
  route?: string;
  /** is the person already on this step's page? (default: the address is exactly `route`; a page that redirects, like Workflows, says so here) */
  onPage?(path: string): boolean;
  /** the `data-tour` name of what is pointed at */
  target: string;
  text(): { title: string; body: string };
  side?: 'top' | 'bottom' | 'left' | 'right';
}
export interface Tour {
  id: TourId;
  steps: TourStep[];
}

const c = () => copy.tour.configurator;
const s = () => copy.tour.supervisor;
const o = () => copy.tour.operator;

export const TOURS: Record<TourId, Tour> = {
  configurator: {
    id: 'configurator',
    steps: [
      { id: 'robots', route: '/configurator/robots', target: 'nav-robots', side: 'right', text: () => c().robots },
      {
        id: 'add-robot',
        route: '/configurator/robots',
        target: 'add-device',
        side: 'bottom',
        text: () => c().addRobot,
      },
      { id: 'maps', route: '/configurator/maps', target: 'nav-maps', side: 'right', text: () => c().maps },
      {
        id: 'create-map',
        route: '/configurator/maps',
        target: 'create-map',
        side: 'bottom',
        text: () => c().createMap,
      },
      { id: 'hardware', route: '/configurator/hardware', target: 'nav-hw', side: 'right', text: () => c().hardware },
      { id: 'fleets', route: '/configurator/fleets', target: 'make-fleet', side: 'bottom', text: () => c().fleets },
      {
        id: 'master',
        route: '/configurator/master-data/materials',
        target: 'nav-md',
        side: 'right',
        text: () => c().master,
      },
      {
        id: 'workflows',
        route: '/configurator', // opens the Workflow Builder (the address redirects to a new workflow)
        onPage: (p) => p.startsWith('/configurator/workflows/'),
        target: 'nav-wf',
        side: 'right',
        text: () => c().workflows,
      },
      { id: 'setup', target: 'setup-progress', side: 'right', text: () => c().setup },
    ],
  },
  supervisor: {
    id: 'supervisor',
    steps: [
      {
        id: 'dashboard',
        route: '/supervisor/dashboard',
        target: 'nav-dashboard',
        side: 'right',
        text: () => s().dashboard,
      },
      { id: 'live', route: '/supervisor/livefloor', target: 'nav-live', side: 'right', text: () => s().live },
      {
        id: 'action',
        route: '/supervisor/action-center',
        target: 'nav-action-center',
        side: 'right',
        text: () => s().action,
      },
      { id: 'reports', route: '/supervisor/reports', target: 'nav-reports', side: 'right', text: () => s().reports },
    ],
  },
  operator: {
    id: 'operator',
    steps: [
      { id: 'book', route: '/operator/book', target: 'nav-book', side: 'right', text: () => o().book },
      { id: 'approve', route: '/operator/approve', target: 'nav-approve', side: 'right', text: () => o().approve },
      { id: 'history', route: '/operator/history', target: 'nav-history', side: 'right', text: () => o().history },
      {
        id: 'action',
        route: '/operator/action-center',
        target: 'nav-action-center',
        side: 'right',
        text: () => o().action,
      },
    ],
  },
};
export const isTourId = (v: string | null): v is TourId =>
  v === 'configurator' || v === 'supervisor' || v === 'operator';

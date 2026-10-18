import { Navigate, useParams } from 'react-router-dom';
import { DeviceDetail } from './components/DeviceDetail';
import { useDevices } from './model/store';
import { findDevice } from './model/validate';
import type { DeviceKind } from './model/types';
import '@/ui/detailPages.css';
import { PageTitleName } from '@/shell/PageTitle';
import { Page } from '@/components/page';

/** One robot / hardware. An unknown name (e.g. after removing it) goes back to the list. */
export function DeviceDetailPage({ kind }: { kind: DeviceKind }) {
  const { name = '' } = useParams();
  const device = findDevice(
    useDevices((s) => s[kind.id]),
    name,
  );
  if (!device) return <Navigate to={`/configurator/${kind.route}`} replace />;
  return (
    <>
      <PageTitleName name={name} />
      <Page className="pt-3">
        <DeviceDetail key={name} kind={kind} device={device} />
      </Page>
    </>
  );
}

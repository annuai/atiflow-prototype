import { Navigate, useParams } from 'react-router-dom';
import { DeviceDetail } from './components/DeviceDetail';
import { useDevices } from './model/store';
import { findDevice } from './model/validate';
import type { DeviceKind } from './model/types';
import './devices.css';

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
      <div className="content dv-detail">
        <DeviceDetail key={name} kind={kind} device={device} />
      </div>
    </>
  );
}

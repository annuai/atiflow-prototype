import { useState } from 'react';
import { CONNECTIONS } from '../model/connections';
import type { ConnectionDef } from '../model/types';
import { ConnectionCard } from './ConnectionCard';
import { EditConnectionModal } from './EditConnectionModal';

/** The connections as cards (add a connection to the catalog and a card appears). */
export function ConnectionsPanel() {
  const [editing, setEditing] = useState<ConnectionDef | null>(null);
  return (
    <>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(340px,1fr))]">{CONNECTIONS.map((c) => <ConnectionCard key={c.id} def={c} onEdit={() => setEditing(c)} />)}</div>
      <EditConnectionModal def={editing} onOpenChange={(o) => !o && setEditing(null)} />
    </>
  );
}

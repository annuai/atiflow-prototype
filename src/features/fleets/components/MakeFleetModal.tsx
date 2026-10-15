import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dataflow03 } from '@untitledui/icons';
import { Input } from '@/components/base/input/input';
import { datasetStore } from '@/data/dataset';
import { ModalShell } from '@/components/modal/ModalShell';
import { wfStore } from '@/features/workflow-builder';
import { copy } from '../copy';
import { fleetPath } from '../paths';

/** "Make a fleet": asks for a name, creates the fleet (the same rules as the sidebar's "Create new fleet": unique, "Fleet" suffix) and opens its page. */
export function MakeFleetModal({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange(o: boolean): void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) setName('');
  };
  const make = () => {
    if (!wfStore.getState().createFleet(name)) return; // it says why (empty, already exists)
    close(false);
    navigate(fleetPath(datasetStore.getState().fleets.at(-1)!.name));
  };
  return (
    <ModalShell
      isOpen={isOpen}
      onOpenChange={close}
      icon={Dataflow03}
      title={copy.makeFleet.title}
      subtitle={copy.makeFleet.subtitle}
      secondary={{ label: copy.makeFleet.cancel, onPress: () => close(false) }}
      primary={{ label: copy.makeFleet.confirm, isDisabled: !name.trim(), onPress: make }}
      onSubmit={make}
    >
      <Input
        autoFocus
        label={copy.makeFleet.label}
        placeholder={copy.makeFleet.placeholder}
        value={name}
        onChange={setName}
      />
    </ModalShell>
  );
}

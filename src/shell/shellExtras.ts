import { useEffect } from 'react';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

/** What a page may add to the shared top bar. Today only the "Ati AI" button's action (the Workflow Builder focuses its prompt bar). */
interface Extras { onAi?: () => void }
const extras = createStore<Extras>(() => ({}));
export const useShellExtras = (): Extras => useStore(extras, (s) => s);
/** Register the Ati AI action while the page is mounted. */
export function useShellAi(onAi: () => void) {
  useEffect(() => { extras.setState({ onAi }); return () => extras.setState({ onAi: undefined }); }, [onAi]);
}

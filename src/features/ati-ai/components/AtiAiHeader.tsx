import { Edit05, XClose } from '@untitledui/icons';
import { copy } from '../copy';
import { Mark } from './MessageList';

/** Mark and name, "New chat" and close. There is no role switch: the assistant works for the workspace the person is in. */
export function AtiAiHeader({ onNew, onClose }: { onNew(): void; onClose(): void }) {
  return (
    <header className="ai-head">
      <Mark size={30} />
      <h2 className="ai-title">{copy.title}</h2>
      <span className="ai-grow" />
      <button type="button" className="ai-icon" aria-label={copy.newChat} title={copy.newChat} onClick={onNew}>
        <Edit05 aria-hidden className="size-5" />
      </button>
      <button type="button" className="ai-icon" aria-label={copy.close} title={copy.close} onClick={onClose}>
        <XClose aria-hidden className="size-5" />
      </button>
    </header>
  );
}

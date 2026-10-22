import { useState } from 'react';
import { Button as AriaButton, DialogTrigger } from 'react-aria-components';
import { Modal, ModalOverlay } from '@/components/application/modals/modal';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from '@/components/base/tooltip/tooltip';
import { copy } from '../copy';
import { useSetup } from '../model/useSetup';
import { SetupPanel } from './SetupPanel';
import './setup.css';

/**
 * The Setup Progress card at the bottom of the configurator's sidebar: "2 of 5", a bar and what to do next. Clicking it opens the list of every step. It shows while setup is
 * unfinished; when the last step is done it disappears. A site that starts finished (the demo data) never shows it. `collapsed` = the narrow rail (a ring).
 */
export function SetupProgress({ collapsed = false }: { collapsed?: boolean }) {
  const setup = useSetup();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (setup.complete) return null; // every step done: the card goes away
  const text = copy.setup.steps[setup.next!].next;
  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      {collapsed ? (
        <Tooltip title={`${copy.setup.title}: ${copy.setup.count(setup.done, setup.total)}`} placement="right">
          <AriaButton
            className="su-rail"
            style={{ ['--su-pct' as string]: setup.percent }}
            aria-label={`${copy.setup.title}: ${copy.setup.count(setup.done, setup.total)}. ${text}`}
          >
            <span>{setup.done}</span>
          </AriaButton>
        </Tooltip>
      ) : (
        <AriaButton className="su-card" data-tour="setup-progress" aria-label={copy.setup.open}>
          <span className="su-row">
            <span>{copy.setup.title}</span>
            <span className="su-count">{copy.setup.count(setup.done, setup.total)}</span>
          </span>
          <span className="su-bar" role="presentation">
            <span className="su-fill block" style={{ width: `${setup.percent}%` }} />
          </span>
          <span className="su-next">{text}</span>
        </AriaButton>
      )}
      <ModalOverlay isDismissable>
        <Modal className="max-w-3xl">
          <SetupPanel
            state={setup}
            onGo={(path) => {
              setOpen(false);
              navigate(path);
            }}
          />
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

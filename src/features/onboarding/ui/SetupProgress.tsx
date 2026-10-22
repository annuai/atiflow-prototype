import { useEffect, useState } from 'react';
import { Button as AriaButton, DialogTrigger, Popover } from 'react-aria-components';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from '@/components/base/tooltip/tooltip';
import { copy } from '../copy';
import { progressStore, useProgress } from '../model/progress';
import { useSetup } from '../model/useSetup';
import { SetupPanel } from './SetupPanel';
import './setup.css';

/**
 * The Setup Progress card at the bottom of the configurator's sidebar: "2 of 5", a bar and what to do next. Clicking it opens the list of every step. It shows while setup is
 * unfinished; when the last step is done it says so once and can be put away. A site that starts finished (the demo data) never shows it. `collapsed` = the narrow rail (a ring).
 */
export function SetupProgress({ collapsed = false }: { collapsed?: boolean }) {
  const setup = useSetup();
  const seen = useProgress((s) => s.seenIncomplete);
  const dismissed = useProgress((s) => s.dismissed);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!setup.complete && !seen) progressStore.getState().set({ seenIncomplete: true });
    if (!setup.complete && dismissed) progressStore.getState().set({ dismissed: false }); // something was taken away again: setup is unfinished, show it
  }, [setup.complete, seen, dismissed]);
  if (setup.complete && (!seen || dismissed)) return null;
  const text = setup.complete ? copy.setup.complete : copy.setup.steps[setup.next!].next;
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
      <Popover
        placement="right bottom"
        offset={12}
        className="rounded-xl bg-primary shadow-xl ring-1 ring-secondary_alt outline-hidden"
      >
        {setup.complete ? (
          <div className="w-[320px] p-5">
            <h2 className="text-md font-semibold text-primary">{copy.setup.complete}</h2>
            <p className="mt-0.5 text-sm text-tertiary">{copy.setup.completeHint}</p>
            <button
              type="button"
              className="mt-4 text-sm font-medium text-brand-secondary"
              onClick={() => {
                progressStore.getState().set({ dismissed: true });
                setOpen(false);
              }}
            >
              {copy.setup.hide}
            </button>
          </div>
        ) : (
          <SetupPanel
            state={setup}
            onGo={(path) => {
              setOpen(false);
              navigate(path);
            }}
          />
        )}
      </Popover>
    </DialogTrigger>
  );
}

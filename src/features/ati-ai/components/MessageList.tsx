import { useEffect, useRef } from 'react';
import { Stars02 } from '@untitledui/icons';
import type { AiMessage, Block, Chip } from '../types';
import { copy } from '../copy';
import { ChartBlock, KpiTiles, TableBlock, ValidationList, WorkflowPreview } from './blocks/Data';
import { ActionsRow, ChipRow, ConfirmationCard, StepsCard, TextBlock, type OnChip } from './blocks/Simple';

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <span className="ai-mark" style={{ width: size, height: size }} aria-hidden>
      <Stars02 style={{ width: size * 0.55, height: size * 0.55 }} />
    </span>
  );
}

interface Handlers {
  onChip: OnChip;
  onConfirm(b: Extract<Block, { type: 'confirmation_card' }>): void;
  onEdit(b: Extract<Block, { type: 'confirmation_card' }>): void;
  onCancel(b: Extract<Block, { type: 'confirmation_card' }>): void;
}
function renderBlock(b: Block, i: number, h: Handlers, animate: boolean, busy: boolean, isLast: boolean) {
  switch (b.type) {
    case 'text':
      return <TextBlock key={i} text={b.text} animate={animate} />;
    case 'chips':
      return <ChipRow key={i} chips={b.chips} onChip={h.onChip} disabled={busy || !isLast} />;
    case 'actions':
      return <ActionsRow key={i} actions={b.actions} onChip={h.onChip} disabled={busy} />;
    case 'confirmation_card':
      return (
        <ConfirmationCard
          key={b.id}
          block={b}
          disabled={busy}
          onConfirm={() => h.onConfirm(b)}
          onEdit={() => h.onEdit(b)}
          onCancel={() => h.onCancel(b)}
        />
      );
    case 'steps_card':
      return <StepsCard key={i} block={b} onChip={h.onChip} disabled={busy} />;
    case 'chart':
      return <ChartBlock key={i} block={b} />;
    case 'table':
      return <TableBlock key={i} block={b} />;
    case 'kpi_tiles':
      return <KpiTiles key={i} block={b} />;
    case 'workflow_preview':
      return <WorkflowPreview key={i} workflow={b.workflow} highlight={b.highlight} title={b.title} />;
    case 'validation_list':
      return <ValidationList key={i} block={b} onChip={h.onChip} disabled={busy} />;
  }
}

/** The conversation: your messages right-aligned in bubbles, the assistant's left-aligned with its mark, a typing indicator while it thinks; scrolls to the newest. */
export function MessageList({
  messages,
  busy,
  streaming,
  handlers,
}: {
  messages: AiMessage[];
  busy: boolean;
  streaming: string | null;
  handlers: Handlers;
}) {
  const end = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length, last?.blocks.length, busy]);
  const thinking = busy && (!last || last.from === 'user');
  return (
    <div className="ai-list" role="log" aria-live="polite" aria-label={copy.panel}>
      {messages.map((m, mi) =>
        m.from === 'user' ? (
          <div key={m.id} className="ai-msg ai-msg-user">
            <p className="ai-bubble">{m.blocks[0]?.type === 'text' ? m.blocks[0].text : ''}</p>
          </div>
        ) : (
          <div key={m.id} className="ai-msg ai-msg-ai">
            <Mark />
            <div className="ai-body">
              {m.blocks.map((b, i) =>
                renderBlock(
                  b,
                  i,
                  handlers,
                  streaming === m.id,
                  busy,
                  mi === messages.length - 1 && i === m.blocks.length - 1,
                ),
              )}
            </div>
          </div>
        ),
      )}
      {thinking && (
        <div className="ai-msg ai-msg-ai" role="status" aria-label={copy.typing}>
          <Mark />
          <div className="ai-dots" aria-hidden>
            <i />
            <i />
            <i />
          </div>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}
export type { Chip };

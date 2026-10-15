import { useState, type FormEvent } from 'react';
import { Send01, SearchLg, Stars02 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { wfStore } from '../model/store';
import { copy } from '../copy';

/** Ati AI: describe a workflow in plain text. Same bar position as the Live Floor command bar. */
export function AiPromptBar() {
  const [text, setText] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) {
      document.querySelector<HTMLInputElement>('[data-wf-ai] input')?.focus();
      return;
    }
    if (wfStore.getState().buildFromPrompt(t)) setText('');
  };
  return (
    <form className="float cmd" data-no-pan data-wf-ai onSubmit={submit}>
      <span className="ai">
        <Stars02 className="size-4" />
      </span>
      <Input
        size="sm"
        icon={SearchLg}
        className="flex-1"
        wrapperClassName="shadow-none ring-0 bg-transparent"
        placeholder={copy.ai.placeholder}
        aria-label={copy.ai.aria}
        value={text}
        onChange={setText}
      />
      <Button type="submit" size="sm" color="primary" iconLeading={Send01} aria-label={copy.ai.send} />
    </form>
  );
}

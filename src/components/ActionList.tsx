import { useState, type FormEvent } from 'react';
import { Instrument } from '@/components/Instrument';
import type { Action } from '@/types';
import './ActionList.css';

interface Props {
  actions: Action[];
  /** When true, the oldest open action is lit as the next step. */
  emphasiseNext: boolean;
  onToggle: (a: Action) => Promise<void>;
  onRemove: (a: Action) => Promise<void>;
  onAdd: (text: string) => Promise<void>;
}

/** Next actions for a project: complete, undo, let go, add. Shared by every room. */
export function ActionList({ actions, emphasiseNext, onToggle, onRemove, onAdd }: Props) {
  const [text, setText] = useState('');
  const open = actions.filter((a) => !a.doneAt).sort((a, b) => a.createdAt - b.createdAt);
  const done = actions.filter((a) => a.doneAt).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));

  const add = async (e: FormEvent | { preventDefault: () => void }) => {
    e.preventDefault();
    if (!text.trim()) return;
    await onAdd(text.trim());
    setText('');
  };

  return (
    <div className="actionlist">
      <ul className="actions">
        {open.map((a, i) => (
          <li key={a.id} className={`action ${i === 0 && emphasiseNext ? 'action--next' : ''}`}>
            <button type="button" className="action__check" aria-label={`Mark done: ${a.text}`} onClick={() => void onToggle(a)} />
            <span className="action__text">{a.text}</span>
            <button type="button" className="action__remove" aria-label={`Let go of: ${a.text}`} onClick={() => void onRemove(a)}>×</button>
          </li>
        ))}
        {done.map((a) => (
          <li key={a.id} className="action action--done">
            <button type="button" className="action__check is-done" aria-label={`Undo: ${a.text}`} onClick={() => void onToggle(a)} />
            <span className="action__text">{a.text}</span>
          </li>
        ))}
      </ul>
      <form className="action-add" onSubmit={(e) => void add(e)}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={open.length ? 'Another next step' : 'What is the smallest next step?'}
          maxLength={200}
          aria-label="New next action"
          onKeyDown={(e) => { if (e.key === 'Enter') void add(e); }}
        />
        <Instrument tone="quiet" type="submit" disabled={!text.trim()}>Add</Instrument>
      </form>
    </div>
  );
}

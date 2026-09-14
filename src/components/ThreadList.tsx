import { useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Instrument } from '@/components/Instrument';
import { SelectField, TextArea } from '@/components/Field';
import { THREAD_KINDS, THREAD_LABEL, type Thread, type ThreadKind } from '@/types';

export interface ThreadTitle { title: string; to?: string; note?: string }

interface Props {
  threads: Thread[];
  selfId: string;
  titles: Map<string, ThreadTitle>;
  /** When set, in-room targets are buttons that select; otherwise they are links. */
  onSelect?: (id: string) => void;
  onUpdate: (thread: Thread, patch: { kind: ThreadKind; why: string }) => Promise<void>;
  onRemove: (thread: Thread) => Promise<void>;
}

/** The threads tied to one thing, each editable in place: change the relation or the reason without cutting it. */
export function ThreadList({ threads, selfId, titles, onSelect, onUpdate, onRemove }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  if (!threads.length) return null;
  return (
    <ul className="threads">
      {threads.map((t) => {
        const outgoing = t.fromId === selfId;
        const otherId = outgoing ? t.toId : t.fromId;
        const other = titles.get(otherId);
        const target = !other
          ? <span className="thread__target thread__target--gone">something that is gone</span>
          : other.to
            ? <RouterLink className="thread__target" to={other.to}>{other.title}{other.note ? <span className="plaque"> {other.note}</span> : null}</RouterLink>
            : onSelect
              ? <button type="button" className="thread__target" onClick={() => onSelect(otherId)}>{other.title}{other.note ? <span className="plaque"> {other.note}</span> : null}</button>
              : <span className="thread__target">{other.title}</span>;
        return (
          <li key={t.id} className="thread">
            {editing === t.id ? (
              <ThreadEditor thread={t} onSave={async (patch) => { await onUpdate(t, patch); setEditing(null); }} onCancel={() => setEditing(null)} />
            ) : (
              <>
                <p className="thread__line">
                  {outgoing ? <em>This</em> : target}{' '}<span className="thread__kind">{THREAD_LABEL[t.kind]}</span>{' '}{outgoing ? target : <em>this</em>}
                </p>
                {t.why && <p className="thread__why">“{t.why}”</p>}
                <span className="thread__tools">
                  <button type="button" className="thread__edit plaque" onClick={() => setEditing(t.id)} aria-label={`Edit this thread`}>edit</button>
                  <button type="button" className="thread__remove" aria-label="Cut this thread" onClick={() => void onRemove(t)}>×</button>
                </span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ThreadEditor({ thread, onSave, onCancel }: { thread: Thread; onSave: (patch: { kind: ThreadKind; why: string }) => Promise<void>; onCancel: () => void }) {
  const [kind, setKind] = useState<ThreadKind>(thread.kind);
  const [why, setWhy] = useState(thread.why ?? '');
  return (
    <form className="goal-form" onSubmit={(e: FormEvent) => { e.preventDefault(); void onSave({ kind, why: why.trim() }); }}>
      <SelectField label="How they relate" value={kind} onChange={(e) => setKind(e.target.value as ThreadKind)}>
        {THREAD_KINDS.map((k) => <option key={k} value={k}>{THREAD_LABEL[k]}</option>)}
      </SelectField>
      <TextArea label="Why (in your words)" value={why} onChange={(e) => setWhy(e.target.value)} rows={2} maxLength={300} autoFocus />
      <div className="form-actions">
        <Instrument tone="primary" type="submit">Save the thread</Instrument>
        <Instrument tone="quiet" type="button" onClick={onCancel}>Cancel</Instrument>
      </div>
    </form>
  );
}

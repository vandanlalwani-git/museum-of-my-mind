import { useMemo, useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Instrument } from '@/components/Instrument';
import { SelectField, TextArea, TextField } from '@/components/Field';
import { relativeAge } from '@/lib/dates';
import { paragraphs, parseTags } from '@/lib/text';
import { THREAD_KINDS, THREAD_LABEL, type Link, type Memory, type MuseumRecords, type Note, type Thread, type ThreadKind } from '@/types';
import { ITEM_KIND_LABEL } from './ArchiveIndex';
import { allItems, isArchived, itemKind, type ArchiveItem } from './graph';

export interface ArchiveOps {
  updateItem: (item: ArchiveItem, patch: Partial<Note> & Partial<Link> & Partial<Memory>) => Promise<void>;
  setTags: (item: ArchiveItem, tags: string[]) => Promise<void>;
  archiveItem: (item: ArchiveItem) => Promise<void>;
  restoreItem: (item: ArchiveItem) => Promise<void>;
  deleteItem: (item: ArchiveItem) => Promise<void>;
  addThread: (fromId: string, toId: string, kind: ThreadKind, why: string) => Promise<void>;
  removeThread: (id: string) => Promise<void>;
}

interface Props {
  item: ArchiveItem;
  records: MuseumRecords;
  ops: ArchiveOps;
  onBack: () => void;
  onSelect: (id: string) => void;
}

export function ItemPanel({ item, records, ops, onBack, onSelect }: Props) {
  const [mode, setMode] = useState<'view' | 'edit' | 'connect' | 'tags' | 'confirm-delete'>('view');
  const kind = itemKind(item);
  const archived = isArchived(item);
  const titles = useMemo(() => {
    const m = new Map<string, { title: string; where: 'archive' | 'observatory'; archived?: boolean }>();
    for (const i of allItems(records)) m.set(i.id, { title: i.title, where: 'archive', archived: isArchived(i) });
    for (const g of records.goals) m.set(g.id, { title: g.title, where: 'observatory' });
    for (const p of records.projects) m.set(p.id, { title: p.title, where: 'observatory' });
    return m;
  }, [records]);
  const threads = records.threads.filter((t) => t.fromId === item.id || t.toId === item.id);
  const attached = kind === 'memory' ? [(item as Memory).goalId, (item as Memory).projectId].filter(Boolean).map((id) => titles.get(id!)) : [];

  return (
    <div className="panel">
      <button type="button" className="panel__back plaque" onClick={onBack}>← The wall</button>

      {mode === 'edit' ? (
        <ItemEditor item={item} records={records} onSave={async (patch) => { await ops.updateItem(item, patch); setMode('view'); }} onCancel={() => setMode('view')} />
      ) : (
        <header className="panel__head">
          <span className="plaque">{ITEM_KIND_LABEL[kind]}{archived ? ' · put away' : ''} · kept {relativeAge(item.createdAt)}</span>
          <h2 className="panel__title">{item.title}</h2>
          {kind === 'link' && (
            <p className="arc-url"><a href={(item as Link).url} target="_blank" rel="noopener noreferrer">{(item as Link).url}</a></p>
          )}
          {kind === 'memory' && (
            <p className="plaque">Happened {new Date((item as Memory).occurredAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}{attached.length ? ` · with ${attached.map((a) => a?.title).join(', ')}` : ''}</p>
          )}
          <Body item={item} />
          <div className="form-actions">
            <Instrument tone="quiet" onClick={() => setMode('edit')}>Edit</Instrument>
            <Instrument tone="quiet" onClick={() => setMode('tags')}>Tags</Instrument>
            <Instrument tone="quiet" onClick={() => setMode('connect')}>Connect</Instrument>
            {archived
              ? <Instrument tone="quiet" onClick={() => void ops.restoreItem(item)}>Bring it back</Instrument>
              : <Instrument tone="quiet" onClick={() => void ops.archiveItem(item)}>Put it away</Instrument>}
            <Instrument tone="quiet" onClick={() => setMode('confirm-delete')}>Let it go</Instrument>
          </div>
        </header>
      )}

      {mode === 'confirm-delete' && (
        <div className="panel__next panel__next--empty">
          <span className="plaque">Let it go?</span>
          <p className="panel__next-project">This removes it and its threads for good. Putting it away keeps it, out of sight.</p>
          <div className="form-actions">
            <Instrument tone="ember" onClick={() => void ops.deleteItem(item)}>Let it go</Instrument>
            <Instrument tone="quiet" onClick={() => setMode('view')}>Keep it</Instrument>
          </div>
        </div>
      )}

      {mode === 'tags' ? (
        <TagEditor tags={item.tags} onSave={async (tags) => { await ops.setTags(item, tags); setMode('view'); }} onCancel={() => setMode('view')} />
      ) : (
        <ul className="tags" aria-label="Tags">
          {item.tags.map((t) => <li key={t}><span className="tag tag--static">{t}</span></li>)}
          {item.tags.length === 0 && <li className="panel__empty">No tags yet.</li>}
        </ul>
      )}

      <section className="panel__section">
        <div className="panel__section-head">
          <span className="plaque">Threads · {threads.length}</span>
          {mode !== 'connect' && <Instrument tone="quiet" onClick={() => setMode('connect')}>Tie a thread</Instrument>}
        </div>
        {mode === 'connect' && (
          <ConnectForm
            item={item}
            records={records}
            onSave={async (toId, k, why, reverse) => { await (reverse ? ops.addThread(toId, item.id, k, why) : ops.addThread(item.id, toId, k, why)); setMode('view'); }}
            onCancel={() => setMode('view')}
          />
        )}
        {threads.length === 0 && mode !== 'connect' && (
          <p className="panel__empty">Nothing is tied to this yet. A thread says how two things belong together, in your words.</p>
        )}
        <ul className="threads">
          {threads.map((t: Thread) => {
            const outgoing = t.fromId === item.id;
            const otherId = outgoing ? t.toId : t.fromId;
            const other = titles.get(otherId);
            return (
              <li key={t.id} className="thread">
                <p className="thread__line">
                  {outgoing ? <em>This</em> : <ThreadTarget id={otherId} info={other} onSelect={onSelect} />}
                  {' '}<span className="thread__kind">{THREAD_LABEL[t.kind]}</span>{' '}
                  {outgoing ? <ThreadTarget id={otherId} info={other} onSelect={onSelect} /> : <em>this</em>}
                </p>
                {t.why && <p className="thread__why">“{t.why}”</p>}
                <button type="button" className="thread__remove" aria-label="Cut this thread" onClick={() => void ops.removeThread(t.id)}>×</button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function ThreadTarget({ id, info, onSelect }: { id: string; info: { title: string; where: 'archive' | 'observatory'; archived?: boolean } | undefined; onSelect: (id: string) => void }) {
  if (!info) return <span className="thread__target thread__target--gone">something that is gone</span>;
  if (info.where === 'observatory') {
    return <RouterLink className="thread__target" to="/observatory">{info.title} <span className="plaque">observatory</span></RouterLink>;
  }
  return <button type="button" className="thread__target" onClick={() => onSelect(id)}>{info.title}{info.archived ? <span className="plaque"> put away</span> : null}</button>;
}

function Body({ item }: { item: ArchiveItem }) {
  const text = 'url' in item ? item.whySaved : item.body;
  if (!text) return null;
  return (
    <div className="arc-body">
      {paragraphs(text).map((lines, i) => (
        <p key={i}>{lines.map((l, j) => <span key={j}>{l}{j < lines.length - 1 && <br />}</span>)}</p>
      ))}
    </div>
  );
}

function TagEditor({ tags, onSave, onCancel }: { tags: string[]; onSave: (t: string[]) => Promise<void>; onCancel: () => void }) {
  const [value, setValue] = useState(tags.join(', '));
  return (
    <form className="goal-form" onSubmit={(e: FormEvent) => { e.preventDefault(); void onSave(parseTags(value)); }}>
      <TextField label="Tags" value={value} onChange={(e) => setValue(e.target.value)} placeholder="fog, clock, family" hint="Separate with commas or spaces. Tags pull items together on the wall." autoFocus />
      <div className="form-actions">
        <Instrument tone="primary" type="submit">Save tags</Instrument>
        <Instrument tone="quiet" type="button" onClick={onCancel}>Cancel</Instrument>
      </div>
    </form>
  );
}

function ItemEditor({ item, records, onSave, onCancel }: { item: ArchiveItem; records: MuseumRecords; onSave: (patch: Partial<Note> & Partial<Link> & Partial<Memory>) => Promise<void>; onCancel: () => void }) {
  const kind = itemKind(item);
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState('url' in item ? item.whySaved : item.body);
  const [url, setUrl] = useState('url' in item ? item.url : '');
  const [noteKind, setNoteKind] = useState<'note' | 'idea'>(kind === 'idea' ? 'idea' : 'note');
  const [date, setDate] = useState(kind === 'memory' ? new Date((item as Memory).occurredAt).toISOString().slice(0, 10) : '');
  const [goalId, setGoalId] = useState(kind === 'memory' ? ((item as Memory).goalId ?? '') : '');
  const [projectId, setProjectId] = useState(kind === 'memory' ? ((item as Memory).projectId ?? '') : '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (kind === 'link') { void onSave({ title: title.trim(), url: url.trim(), whySaved: body.trim() }); return; }
    if (kind === 'memory') {
      const occurredAt = date ? new Date(date + 'T12:00:00').getTime() : (item as Memory).occurredAt;
      void onSave({ title: title.trim(), body: body.trim(), occurredAt, ...(goalId ? { goalId } : {}), ...(projectId ? { projectId } : {}) });
      return;
    }
    void onSave({ title: title.trim(), body: body.trim(), ...(noteKind === 'idea' ? { kind: 'idea' as const } : { kind: 'note' as const }) });
  };

  return (
    <form className="goal-form" onSubmit={submit}>
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required autoFocus />
      {kind === 'link' && <TextField label="Address" type="url" value={url} onChange={(e) => setUrl(e.target.value)} required />}
      <TextArea label={kind === 'link' ? 'Why you saved it' : 'Body'} value={body} onChange={(e) => setBody(e.target.value)} rows={kind === 'link' ? 2 : 6} maxLength={20_000} />
      {(kind === 'note' || kind === 'idea') && (
        <SelectField label="Kind" value={noteKind} onChange={(e) => setNoteKind(e.target.value as 'note' | 'idea')}>
          <option value="note">Thought</option>
          <option value="idea">Idea</option>
        </SelectField>
      )}
      {kind === 'memory' && (
        <>
          <TextField label="When" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <SelectField label="Goal" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">None</option>
            {records.goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </SelectField>
          <SelectField label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">None</option>
            {records.projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </SelectField>
        </>
      )}
      <div className="form-actions">
        <Instrument tone="primary" type="submit" disabled={!title.trim()}>Save</Instrument>
        <Instrument tone="quiet" type="button" onClick={onCancel}>Cancel</Instrument>
      </div>
    </form>
  );
}

function ConnectForm({ item, records, onSave, onCancel }: { item: ArchiveItem; records: MuseumRecords; onSave: (toId: string, kind: ThreadKind, why: string, reverse: boolean) => Promise<void>; onCancel: () => void }) {
  const [kind, setKind] = useState<ThreadKind>('supports');
  const [q, setQ] = useState('');
  const [toId, setToId] = useState<string | null>(null);
  const [why, setWhy] = useState('');
  const [reverse, setReverse] = useState(false);

  const candidates = useMemo(() => {
    const list: { id: string; title: string; where: string }[] = [];
    for (const i of allItems(records)) if (i.id !== item.id) list.push({ id: i.id, title: i.title, where: ITEM_KIND_LABEL[itemKind(i)].toLowerCase() });
    for (const g of records.goals) list.push({ id: g.id, title: g.title, where: 'goal' });
    for (const p of records.projects) list.push({ id: p.id, title: p.title, where: 'project' });
    const needle = q.trim().toLowerCase();
    return (needle ? list.filter((c) => c.title.toLowerCase().includes(needle)) : list).slice(0, 8);
  }, [records, item.id, q]);
  const chosen = candidates.find((c) => c.id === toId) ?? null;

  return (
    <form className="goal-form connect" onSubmit={(e: FormEvent) => { e.preventDefault(); if (toId) void onSave(toId, kind, why, reverse); }}>
      <p className="connect__preview">
        {reverse ? <><strong>{chosen?.title ?? '…'}</strong> {THREAD_LABEL[kind]} <em>this</em></> : <><em>This</em> {THREAD_LABEL[kind]} <strong>{chosen?.title ?? '…'}</strong></>}
      </p>
      <SelectField label="How they relate" value={kind} onChange={(e) => setKind(e.target.value as ThreadKind)}>
        {THREAD_KINDS.map((k) => <option key={k} value={k}>{THREAD_LABEL[k]}</option>)}
      </SelectField>
      <label className="settings__toggle"><input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} /> The other way round</label>
      <TextField label="To" value={q} onChange={(e) => { setQ(e.target.value); setToId(null); }} placeholder="Search notes, links, memories, goals, projects" autoFocus />
      <ul className="connect__list" role="listbox" aria-label="Candidates">
        {candidates.map((c) => (
          <li key={c.id}>
            <button type="button" role="option" aria-selected={toId === c.id} className={`connect__cand ${toId === c.id ? 'is-active' : ''}`} onClick={() => { setToId(c.id); setQ(c.title); }}>
              <span className="display">{c.title}</span> <span className="plaque">{c.where}</span>
            </button>
          </li>
        ))}
        {candidates.length === 0 && <li className="panel__empty">Nothing matches.</li>}
      </ul>
      <TextArea label="Why (in your words)" value={why} onChange={(e) => setWhy(e.target.value)} rows={2} maxLength={300} placeholder="What makes these two belong together?" />
      <div className="form-actions">
        <Instrument tone="primary" type="submit" disabled={!toId}>Tie the thread</Instrument>
        <Instrument tone="quiet" type="button" onClick={onCancel}>Cancel</Instrument>
      </div>
    </form>
  );
}

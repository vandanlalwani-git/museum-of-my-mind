import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Instrument } from '@/components/Instrument';
import { SelectField, TextField } from '@/components/Field';
import { ERROR_TEXT, estimateBytes, reflect, type ReflectOutcome } from '@/ai/client';
import { clearSessionKey, hasSessionKey, looksLikeAnthropicKey, onSessionKeyChange, setSessionKey } from '@/ai/session';
import { DEFAULT_MODEL, LIMITS, MODELS, MODES, type ReflectItem, type ReflectMode, type ReflectRequest } from '../../../shared/reflect-schema';
import { makeReflection, makeThread, touched } from '@/data/factories';
import { relativeAge } from '@/lib/dates';
import { normaliseTag } from '@/lib/text';
import { useMuseumStore } from '@/store/museum';
import { useMuseumOps } from '@/store/ops';
import { useSettingsStore } from '@/store/settings';
import { useUiStore } from '@/store/ui';
import type { Reflection, ThreadKind } from '@/types';
import './reflect.css';

type Step = 'choose' | 'preview' | 'sending' | 'review';
type Decision = 'pending' | 'accepted' | 'rejected';

interface Proposal<T> { key: string; original: T; value: T; decision: Decision; editing: boolean }

export default function Reflect() {
  const aiEnabled = useSettingsStore((s) => s.aiEnabled);
  const museumId = useMuseumStore((s) => s.activeMuseumId)!;
  const records = useMuseumStore((s) => s.records);
  const upsert = useMuseumStore((s) => s.upsert);
  const remove = useMuseumStore((s) => s.remove);
  const ops = useMuseumOps();
  const say = useUiStore((s) => s.say);

  const [step, setStep] = useState<Step>('choose');
  const [mode, setMode] = useState<ReflectMode>('themes');
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [keyHeld, setKeyHeld] = useState(hasSessionKey());
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Extract<ReflectOutcome, { ok: true }> | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => onSessionKeyChange(() => setKeyHeld(hasSessionKey())), []);

  const catalogue = useMemo(() => {
    const rows: { item: ReflectItem; group: string; age: number }[] = [];
    for (const g of records.goals) rows.push({ group: 'Goals', age: g.updatedAt, item: { id: g.id, kind: 'goal', title: g.title, body: g.why, tags: g.tags } });
    for (const p of records.projects) rows.push({ group: 'Projects', age: p.updatedAt, item: { id: p.id, kind: 'project', title: p.title, body: p.summary, tags: p.tags } });
    for (const n of records.notes) rows.push({ group: 'Notes and ideas', age: n.updatedAt, item: { id: n.id, kind: n.kind === 'idea' ? 'idea' : 'note', title: n.title, body: n.body, tags: n.tags } });
    for (const l of records.links) rows.push({ group: 'Links', age: l.updatedAt, item: { id: l.id, kind: 'link', title: l.title, body: `${l.url}\n${l.whySaved}`, tags: l.tags } });
    for (const m of records.memories) rows.push({ group: 'Memories', age: m.updatedAt, item: { id: m.id, kind: 'memory', title: m.title, body: m.body, tags: m.tags } });
    return rows.sort((a, b) => b.age - a.age);
  }, [records]);
  const groups = ['Goals', 'Projects', 'Notes and ideas', 'Links', 'Memories'];
  const visible = catalogue.filter((r) => !search || (r.item.title + ' ' + r.item.body + ' ' + r.item.tags.join(' ')).toLowerCase().includes(search.toLowerCase()));

  const request: ReflectRequest = useMemo(() => ({
    mode, model,
    items: catalogue.filter((r) => selected.has(r.item.id)).map((r) => ({ ...r.item, body: r.item.body.slice(0, LIMITS.MAX_ITEM_CHARS), title: r.item.title.slice(0, LIMITS.MAX_TITLE_CHARS) })),
  }), [catalogue, selected, mode, model]);
  const bytes = estimateBytes(request);
  const tooMany = selected.size > LIMITS.MAX_ITEMS;
  const tooBig = bytes > LIMITS.MAX_BODY_BYTES;

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const send = async () => {
    setError(null);
    if (!keyHeld) {
      if (!looksLikeAnthropicKey(keyInput)) { setError('That does not look like an Anthropic key (they start with sk-ant-). Nothing was sent.'); return; }
      setSessionKey(keyInput);
      setKeyInput('');
    }
    setStep('sending');
    abort.current = new AbortController();
    const out = await reflect(request, abort.current.signal);
    abort.current = null;
    if (!out.ok) {
      if (out.error === 'invalid_key') clearSessionKey();
      setError(ERROR_TEXT[out.error]);
      setStep(out.error === 'cancelled' ? 'preview' : 'preview');
      return;
    }
    setOutcome(out);
    setStep('review');
  };
  const cancel = () => { abort.current?.abort(); };

  if (!aiEnabled) {
    return (
      <section className="rf">
        <header className="rf__head">
          <span className="plaque">Feature off</span>
          <h1 className="rf__title">Ask my AI</h1>
          <p className="rf__intent">This is off. The museum is complete without it: private, local, and free. If you turn it on, you can choose exact items and ask your own Claude to reflect on them, paying with your own API credits.</p>
        </header>
        <div className="form-actions">
          <RouterLink to="/settings" className="instrument instrument--primary">Turn it on at the keeper's desk</RouterLink>
        </div>
        <SavedReflections reflections={records.reflections} onClear={async (r) => { await remove('reflections', r.id); say('Cleared.', undefined, { quiet: true }); }} />
      </section>
    );
  }

  return (
    <section className="rf">
      <header className="rf__head">
        <span className="plaque">Bring your own Claude</span>
        <h1 className="rf__title">Ask my AI</h1>
        <p className="rf__intent">Choose exactly what Claude may read, see exactly what will be sent, then decide what to keep. Nothing changes in the museum unless you accept it.</p>
      </header>

      {step === 'choose' && (
        <div className="rf__grid">
          <div className="rf__col">
            <fieldset className="rf__modes">
              <legend className="plaque">What to ask</legend>
              {MODES.map((m) => (
                <label key={m.id} className={`rf__mode ${mode === m.id ? 'is-active' : ''}`}>
                  <input type="radio" name="mode" checked={mode === m.id} onChange={() => setMode(m.id)} />
                  <span><span className="display rf__mode-title">{m.label}</span><span className="rf__mode-desc">{m.description}</span></span>
                </label>
              ))}
            </fieldset>
            <SelectField label="Model" value={model} onChange={(e) => setModel(e.target.value)} hint="Billed to your own Anthropic account.">
              {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label} · {m.note}</option>)}
            </SelectField>
          </div>
          <div className="rf__col">
            <div className="rf__pick-head">
              <span className="plaque">What Claude may read · {selected.size} chosen · about {Math.max(1, Math.round(bytes / 1000))} KB</span>
              <div className="form-actions">
                <Instrument tone="quiet" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>Choose none</Instrument>
              </div>
            </div>
            <input type="search" className="rf__search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search items to choose" />
            {(tooMany || tooBig) && <p className="rf__warn">{tooMany ? `At most ${LIMITS.MAX_ITEMS} items in one request.` : 'That is too much text for one request. Choose fewer or shorter items.'}</p>}
            <div className="rf__pick">
              {groups.map((g) => {
                const rows = visible.filter((r) => r.group === g);
                if (!rows.length) return null;
                return (
                  <div key={g} className="rf__group">
                    <span className="plaque">{g} · {rows.length}</span>
                    <ul>
                      {rows.map((r) => (
                        <li key={r.item.id}>
                          <label className="rf__item">
                            <input type="checkbox" checked={selected.has(r.item.id)} onChange={() => toggle(r.item.id)} />
                            <span className="rf__item-text"><span className="display">{r.item.title}</span>{r.item.body && <span className="rf__item-body">{r.item.body.slice(0, 90)}{r.item.body.length > 90 ? '…' : ''}</span>}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {catalogue.length === 0 && <p className="panel__empty">Nothing in this museum to choose from yet.</p>}
            </div>
            <div className="form-actions">
              <Instrument tone="primary" onClick={() => { setError(null); setStep('preview'); }} disabled={selected.size === 0 || tooMany || tooBig}>Preview what will be sent</Instrument>
            </div>
          </div>
        </div>
      )}

      {(step === 'preview' || step === 'sending') && (
        <div className="rf__preview">
          <span className="plaque">Before anything leaves this browser</span>
          <h2 className="rf__h2">You are about to send</h2>
          <ul className="rf__facts">
            <li><strong>{request.items.length} item{request.items.length === 1 ? '' : 's'}</strong>, about {Math.max(1, Math.round(bytes / 1000))} KB: the titles, bodies, and tags of what you ticked, and nothing else.</li>
            <li><strong>The task:</strong> {MODES.find((m) => m.id === mode)?.label.toLowerCase()}.</li>
            <li><strong>To:</strong> {MODELS.find((m) => m.id === model)?.label} at Anthropic, through this site's relay, which forwards it once and keeps nothing.</li>
            <li><strong>Paid by:</strong> your own Anthropic API credits. The museum itself charges nothing.</li>
            <li><strong>Treated as:</strong> quoted data. Instructions inside your notes are ignored by the task.</li>
            <li><strong>After that:</strong> what you sent is governed by Anthropic's API and data policies. Nothing is applied here unless you accept it.</li>
          </ul>
          <details className="rf__items">
            <summary className="plaque">The exact items</summary>
            <ul>{request.items.map((i) => <li key={i.id}><span className="plaque">{i.kind}</span> {i.title}</li>)}</ul>
          </details>
          {!keyHeld ? (
            <TextField label="Your Anthropic API key" type="password" autoComplete="off" spellCheck={false} value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="sk-ant-…" hint="Kept only in this tab's memory until you refresh, close it, or forget it at the keeper's desk. Never stored, never logged." />
          ) : (
            <p className="rf__keyheld"><span className="plaque">A key is held for this tab</span> <button type="button" className="rf__forget plaque" onClick={() => clearSessionKey()}>forget it</button></p>
          )}
          {error && <p className="rf__warn" role="alert">{error}</p>}
          <div className="form-actions">
            {step === 'sending'
              ? <><span className="rf__sending">Asking…</span><Instrument tone="quiet" onClick={cancel}>Cancel</Instrument></>
              : <><Instrument tone="primary" onClick={() => void send()} disabled={!keyHeld && !keyInput.trim()}>Send it now</Instrument><Instrument tone="quiet" onClick={() => { setError(null); setStep('choose'); }}>Back, nothing sent</Instrument></>}
          </div>
        </div>
      )}

      {step === 'review' && outcome && (
        <Review
          outcome={outcome}
          request={request}
          records={records}
          onDone={async (accepted, reflection) => {
            const r = makeReflection(museumId, reflection);
            await upsert('reflections', r);
            say(`Kept. ${accepted} proposal${accepted === 1 ? '' : 's'} applied; the reflection is saved in this museum.`);
            setOutcome(null); setSelected(new Set()); setStep('choose');
          }}
          onDiscard={() => { setOutcome(null); setStep('choose'); say('Discarded. Nothing changed.', undefined, { quiet: true }); }}
          apply={{
            tag: async (itemId, tag) => {
              const row = catalogue.find((r) => r.item.id === itemId); if (!row) return;
              const t = normaliseTag(tag); if (!t) return;
              const type = row.item.kind === 'goal' ? 'goals' : row.item.kind === 'project' ? 'projects' : row.item.kind === 'link' ? 'links' : row.item.kind === 'memory' ? 'memories' : 'notes';
              const rec = (records[type] as { id: string; tags: string[] }[]).find((x) => x.id === itemId); if (!rec || rec.tags.includes(t)) return;
              await upsert(type, touched({ ...rec, tags: [...rec.tags, t] } as never) as never);
            },
            thread: async (fromId, toId, kind, why) => {
              if (records.threads.some((t) => t.fromId === fromId && t.toId === toId)) return;
              await upsert('threads', makeThread(museumId, fromId, toId, kind, why));
            },
            project: async (title, summary, goalId, sourceIds) => {
              const p = await ops.createProject({ title, summary, goalIds: goalId ? [goalId] : [] });
              for (const sid of sourceIds) await upsert('threads', makeThread(museumId, p.id, sid, 'inspired-by', 'Suggested by Ask my AI, accepted by you.'));
            },
            action: async (projectId, text) => { await ops.addAction(projectId, text); },
          }}
        />
      )}

      {step === 'choose' && (
        <SavedReflections reflections={records.reflections} onClear={async (r) => { await remove('reflections', r.id); say('Cleared.', undefined, { quiet: true }); }} />
      )}
    </section>
  );
}

/* ---------- review ---------- */

interface Apply {
  tag: (itemId: string, tag: string) => Promise<void>;
  thread: (fromId: string, toId: string, kind: ThreadKind, why: string) => Promise<void>;
  project: (title: string, summary: string, goalId: string | undefined, sourceIds: string[]) => Promise<void>;
  action: (projectId: string, text: string) => Promise<void>;
}

function Review({ outcome, request, records, onDone, onDiscard, apply }: { outcome: Extract<ReflectOutcome, { ok: true }>; request: ReflectRequest; records: ReturnType<typeof useMuseumStore.getState>['records']; onDone: (accepted: number, reflection: Omit<Reflection, 'id' | 'museumId' | 'createdAt' | 'updatedAt' | 'lastVisitedAt' | 'tags'>) => Promise<void>; onDiscard: () => void; apply: Apply }) {
  const r = outcome.result;
  const title = (id: string) => request.items.find((i) => i.id === id)?.title ?? records.projects.find((p) => p.id === id)?.title ?? id;
  const mk = <T,>(prefix: string, list: T[]): Proposal<T>[] => list.map((v, i) => ({ key: `${prefix}-${i}`, original: v, value: v, decision: 'pending', editing: false }));
  const [tags, setTags] = useState(() => mk('tag', r.tags));
  const [threads, setThreads] = useState(() => mk('thread', r.threads));
  const [projects, setProjects] = useState(() => mk('project', r.projects));
  const [actions, setActions] = useState(() => mk('action', r.actions.map((a) => ({ ...a, projectId: a.projectId ?? records.projects.find((p) => p.status === 'active')?.id ?? '' }))));
  const [showReasoning, setShowReasoning] = useState(false);
  const [busy, setBusy] = useState(false);
  const activeProjects = records.projects.filter((p) => p.status === 'active' || p.status === 'paused');
  const pending = [...tags, ...threads, ...projects, ...actions].filter((p) => p.decision === 'pending').length;

  const keep = async () => {
    setBusy(true);
    try {
      let n = 0;
      for (const t of tags) if (t.decision === 'accepted') { await apply.tag(t.value.itemId, t.value.tag); n++; }
      for (const t of threads) if (t.decision === 'accepted') { await apply.thread(t.value.fromId, t.value.toId, t.value.kind, t.value.why); n++; }
      for (const p of projects) if (p.decision === 'accepted') { await apply.project(p.value.title, p.value.summary, p.value.goalId, p.value.sourceIds); n++; }
      for (const a of actions) if (a.decision === 'accepted' && a.value.projectId) { await apply.action(a.value.projectId, a.value.text); n++; }
      await onDone(n, {
        mode: request.mode, model: outcome.model, itemIds: request.items.map((i) => i.id), themes: r.themes,
        reflection: r.reflection, reasoning: r.reasoning,
        accepted: { tags: tags.filter((t) => t.decision === 'accepted').length, threads: threads.filter((t) => t.decision === 'accepted').length, projects: projects.filter((p) => p.decision === 'accepted').length, actions: actions.filter((a) => a.decision === 'accepted' && a.value.projectId).length },
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rf__review">
      <div className="rf__reflection">
        <span className="plaque">Reflection · {MODELS.find((m) => m.id === outcome.model)?.label ?? outcome.model} · {outcome.usage.input + outcome.usage.output} tokens</span>
        <p className="rf__reflection-text">{r.reflection}</p>
        {r.themes.length > 0 && <ul className="tags">{r.themes.map((t) => <li key={t}><span className="tag tag--static">{t}</span></li>)}</ul>}
        <button type="button" className="plaque rf__forget" onClick={() => setShowReasoning((v) => !v)} aria-expanded={showReasoning}>{showReasoning ? 'Hide the reasoning' : 'Show the reasoning'}</button>
        {showReasoning && <p className="rf__reasoning">{r.reasoning || 'No reasoning was given.'}</p>}
      </div>

      <ProposalList title="Tags" items={tags} setItems={setTags}
        render={(p) => <><strong>{p.value.tag}</strong> on “{title(p.value.itemId)}”{p.value.why && <span className="rf__why"> — {p.value.why}</span>}</>}
        edit={(p, set) => <TextField label="Tag" value={p.value.tag} onChange={(e) => set({ ...p.value, tag: e.target.value })} />} />
      <ProposalList title="Threads" items={threads} setItems={setThreads}
        render={(p) => <>“{title(p.value.fromId)}” <em>{p.value.kind.replace('-', ' ')}</em> “{title(p.value.toId)}”{p.value.why && <span className="rf__why"> — {p.value.why}</span>}</>}
        edit={(p, set) => <><SelectField label="Relation" value={p.value.kind} onChange={(e) => set({ ...p.value, kind: e.target.value as ThreadKind })}>{(['supports', 'inspired-by', 'blocks', 'reminds-me-of'] as const).map((k) => <option key={k} value={k}>{k}</option>)}</SelectField><TextField label="Why" value={p.value.why} onChange={(e) => set({ ...p.value, why: e.target.value })} /></>} />
      <ProposalList title="Projects" items={projects} setItems={setProjects}
        render={(p) => <><strong>{p.value.title}</strong>{p.value.summary && <span className="rf__why"> — {p.value.summary}</span>}{p.value.sourceIds.length > 0 && <span className="rf__why"> (from {p.value.sourceIds.map(title).join(', ')})</span>}</>}
        edit={(p, set) => <><TextField label="Project" value={p.value.title} onChange={(e) => set({ ...p.value, title: e.target.value })} /><TextField label="Summary" value={p.value.summary} onChange={(e) => set({ ...p.value, summary: e.target.value })} /></>} />
      <ProposalList title="Next actions" items={actions} setItems={setActions}
        render={(p) => <><strong>{p.value.text}</strong> for “{p.value.projectId ? title(p.value.projectId) : 'no project'}”{p.value.why && <span className="rf__why"> — {p.value.why}</span>}</>}
        edit={(p, set) => <><TextField label="Next step" value={p.value.text} onChange={(e) => set({ ...p.value, text: e.target.value })} /><SelectField label="For the project" value={p.value.projectId ?? ''} onChange={(e) => set({ ...p.value, projectId: e.target.value })}><option value="">Choose a project</option>{activeProjects.map((pr) => <option key={pr.id} value={pr.id}>{pr.title}</option>)}</SelectField></>} />

      <div className="form-actions rf__done">
        <Instrument tone="primary" onClick={() => void keep()} disabled={busy}>Keep the reflection{[...tags, ...threads, ...projects, ...actions].some((p) => p.decision === 'accepted') ? ' and apply what you accepted' : ''}</Instrument>
        <Instrument tone="quiet" onClick={onDiscard} disabled={busy}>Discard everything</Instrument>
        {pending > 0 && <span className="rf__pending plaque">{pending} proposal{pending === 1 ? '' : 's'} still undecided; undecided means rejected</span>}
      </div>
    </div>
  );
}

function ProposalList<T>({ title, items, setItems, render, edit }: { title: string; items: Proposal<T>[]; setItems: (f: (p: Proposal<T>[]) => Proposal<T>[]) => void; render: (p: Proposal<T>) => React.ReactNode; edit: (p: Proposal<T>, set: (v: T) => void) => React.ReactNode }) {
  if (!items.length) return null;
  const update = (key: string, patch: Partial<Proposal<T>>) => setItems((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  return (
    <section className="rf__proposals">
      <span className="plaque">{title} · {items.length} proposed</span>
      <ul>
        {items.map((p) => (
          <li key={p.key} className={`rf__proposal is-${p.decision}`}>
            {p.editing ? (
              <div className="goal-form">
                {edit(p, (v) => update(p.key, { value: v }))}
                <div className="form-actions">
                  <Instrument tone="primary" onClick={() => update(p.key, { editing: false, decision: 'accepted' })}>Accept as edited</Instrument>
                  <Instrument tone="quiet" onClick={() => update(p.key, { editing: false, value: p.original })}>Cancel</Instrument>
                </div>
              </div>
            ) : (
              <>
                <p className="rf__proposal-text">{render(p)}</p>
                <div className="form-actions">
                  <Instrument tone={p.decision === 'accepted' ? 'primary' : 'default'} onClick={() => update(p.key, { decision: 'accepted' })} aria-pressed={p.decision === 'accepted'}>Accept</Instrument>
                  <Instrument onClick={() => update(p.key, { editing: true })}>Edit</Instrument>
                  <Instrument tone={p.decision === 'rejected' ? 'ember' : 'quiet'} onClick={() => update(p.key, { decision: 'rejected' })} aria-pressed={p.decision === 'rejected'}>Reject</Instrument>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SavedReflections({ reflections, onClear }: { reflections: Reflection[]; onClear: (r: Reflection) => Promise<void> }) {
  const list = reflections.slice().sort((a, b) => b.createdAt - a.createdAt);
  return (
    <section className="rf__saved">
      <span className="plaque">Kept reflections · {list.length}</span>
      {list.length === 0 ? <p className="panel__empty">Nothing kept yet. Kept reflections are stored here, in this browser, and cost nothing to read again.</p> : (
        <ul>
          {list.map((r) => (
            <li key={r.id} className="rf__saved-item">
              <span className="plaque">{MODES.find((m) => m.id === r.mode)?.label ?? r.mode} · {relativeAge(r.createdAt)} · {r.itemIds.length} items · {r.accepted.tags + r.accepted.threads + r.accepted.projects + r.accepted.actions} applied</span>
              <p className="rf__reflection-text">{r.reflection}</p>
              {r.themes.length > 0 && <ul className="tags">{r.themes.map((t) => <li key={t}><span className="tag tag--static">{t}</span></li>)}</ul>}
              <div className="form-actions"><Instrument tone="quiet" onClick={() => void onClear(r)}>Clear this reflection</Instrument></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

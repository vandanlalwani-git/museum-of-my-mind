import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Instrument } from '@/components/Instrument';
import { SelectField, TextField } from '@/components/Field';
import { relativeAge } from '@/lib/dates';
import { snippet } from '@/lib/text';
import { useMuseumStore } from '@/store/museum';
import { useMuseumOps, STATUS_LABEL } from '@/store/ops';
import type { Goal, Horizon, Link, Memory, Note, Project } from '@/types';
import './library.css';

type Kind = 'all' | 'goals' | 'projects' | 'notes' | 'links' | 'memories';
type Row = { id: string; kind: Exclude<Kind, 'all'>; title: string; sub: string; meta: string; to: string; updatedAt: number };

const FILTERS: { id: Kind; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'goals', label: 'Goals' },
  { id: 'projects', label: 'Projects' },
  { id: 'notes', label: 'Notes' },
  { id: 'links', label: 'Links' },
  { id: 'memories', label: 'Memories' },
];

/** Everything in one searchable place. Opening a row goes to the room that knows it best. */
export default function Library() {
  const records = useMuseumStore((s) => s.records);
  const ops = useMuseumOps();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [creating, setCreating] = useState<'goal' | 'project' | null>(null);

  useEffect(() => {
    const wanted = params.get('new');
    if (wanted === 'goal' || wanted === 'project') {
      setCreating(wanted);
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const g of records.goals as Goal[]) out.push({ id: g.id, kind: 'goals', title: g.title, sub: g.why, meta: `${g.state === 'active' ? 'In the sky' : g.state} · ${g.horizon}`, to: `/observatory?goal=${g.id}`, updatedAt: g.updatedAt });
    for (const p of records.projects as Project[]) out.push({ id: p.id, kind: 'projects', title: p.title, sub: p.summary, meta: `${STATUS_LABEL[p.status]} · ${Math.round(p.progress * 100)}%`, to: `/workshop?project=${p.id}`, updatedAt: p.updatedAt });
    for (const n of records.notes as Note[]) out.push({ id: n.id, kind: 'notes', title: n.title, sub: n.body, meta: n.kind === 'idea' ? 'Idea' : 'Note', to: `/archive?item=${n.id}`, updatedAt: n.updatedAt });
    for (const l of records.links as Link[]) out.push({ id: l.id, kind: 'links', title: l.title, sub: l.whySaved || l.url, meta: 'Link', to: `/archive?item=${l.id}`, updatedAt: l.updatedAt });
    for (const m of records.memories as Memory[]) out.push({ id: m.id, kind: 'memories', title: m.title, sub: m.body, meta: 'Memory', to: `/archive?item=${m.id}`, updatedAt: m.updatedAt });
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [records]);

  const needle = q.trim().toLowerCase();
  const visible = rows
    .filter((r) => kind === 'all' || r.kind === kind)
    .filter((r) => !needle || needle.split(/\s+/).every((w) => (r.title + ' ' + r.sub).toLowerCase().includes(w)));
  const count = (k: Kind) => (k === 'all' ? rows.length : rows.filter((r) => r.kind === k).length);

  return (
    <section className="lib">
      <header className="lib__head">
        <span className="plaque">Everything you have kept</span>
        <h1 className="lib__title">Library</h1>
        <p className="lib__intent">Goals, projects, notes, links, and memories, in one list. Search it, or open anything to work on it.</p>
      </header>

      <div className="lib__tools">
        <input type="search" className="lib__search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search everything" aria-label="Search the library" />
        <div className="lib__new">
          <Instrument onClick={() => setCreating(creating === 'goal' ? null : 'goal')} aria-expanded={creating === 'goal'}>New goal</Instrument>
          <Instrument onClick={() => setCreating(creating === 'project' ? null : 'project')} aria-expanded={creating === 'project'}>New project</Instrument>
        </div>
      </div>

      {creating === 'goal' && <NewGoalForm onDone={() => setCreating(null)} onCreate={async (v) => { await ops.createGoal(v); }} />}
      {creating === 'project' && <NewProjectForm goals={records.goals} onDone={() => setCreating(null)} onCreate={async (v) => { await ops.createProject(v); }} />}

      <nav className="lib__filters" aria-label="Filter by kind">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={`lib__filter ${kind === f.id ? 'is-active' : ''}`} aria-pressed={kind === f.id} onClick={() => setKind(f.id)}>
            {f.label} <span className="tabular">{count(f.id)}</span>
          </button>
        ))}
      </nav>

      {visible.length === 0 ? (
        <p className="lib__empty">
          {rows.length === 0
            ? 'Nothing here yet. Anything you keep on Today lands in this list.'
            : 'Nothing matches that search.'}
        </p>
      ) : (
        <ul className="lib__rows">
          {visible.map((r) => (
            <li key={r.id}>
              <RouterLink to={r.to} className={`lib__row lib__row--${r.kind}`}>
                <span className="lib__glyph" aria-hidden="true" />
                <span className="lib__text">
                  <span className="lib__row-title display">{r.title}</span>
                  {r.sub && <span className="lib__row-sub">{snippet(r.sub, 110)}</span>}
                  <span className="plaque">{r.meta} · {relativeAge(r.updatedAt)}</span>
                </span>
              </RouterLink>
            </li>
          ))}
        </ul>
      )}

      <footer className="lib__foot">
        <RouterLink to="/observatory" className="lib__link">See the bigger picture →</RouterLink>
        <RouterLink to="/explore" className="lib__link">Explore the other rooms →</RouterLink>
      </footer>
    </section>
  );
}

function NewGoalForm({ onCreate, onDone }: { onCreate: (v: { title: string; why: string; horizon: Horizon }) => Promise<void>; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [horizon, setHorizon] = useState<Horizon>('year');
  return (
    <form className="lib__form" onSubmit={async (e) => { e.preventDefault(); if (!title.trim()) return; await onCreate({ title: title.trim(), why: why.trim(), horizon }); onDone(); }}>
      <TextField label="Goal" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What are you steering by?" autoFocus maxLength={120} required />
      <TextField label="Why it matters" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Optional" maxLength={600} />
      <SelectField label="Horizon" value={horizon} onChange={(e) => setHorizon(e.target.value as Horizon)}>
        <option value="season">This season</option><option value="year">This year</option><option value="decade">This decade</option><option value="lifetime">A lifetime</option>
      </SelectField>
      <div className="form-actions"><Instrument tone="primary" type="submit" disabled={!title.trim()}>Set it in the sky</Instrument><Instrument tone="quiet" type="button" onClick={onDone}>Cancel</Instrument></div>
    </form>
  );
}

function NewProjectForm({ goals, onCreate, onDone }: { goals: Goal[]; onCreate: (v: { title: string; summary: string; goalIds: string[] }) => Promise<void>; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [goalId, setGoalId] = useState('');
  const live = goals.filter((g) => g.state === 'active' || g.state === 'dormant');
  return (
    <form className="lib__form" onSubmit={async (e) => { e.preventDefault(); if (!title.trim()) return; await onCreate({ title: title.trim(), summary: summary.trim(), goalIds: goalId ? [goalId] : [] }); onDone(); }}>
      <TextField label="Project" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Something with an end" autoFocus maxLength={120} required />
      <TextField label="What it is" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Optional" maxLength={600} />
      <SelectField label="Serves" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
        <option value="">No goal, for now</option>
        {live.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
      </SelectField>
      <div className="form-actions"><Instrument tone="primary" type="submit" disabled={!title.trim()}>Put it on the bench</Instrument><Instrument tone="quiet" type="button" onClick={onDone}>Cancel</Instrument></div>
    </form>
  );
}

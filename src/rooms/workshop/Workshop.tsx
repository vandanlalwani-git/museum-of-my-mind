import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Instrument } from '@/components/Instrument';
import { SelectField, TextArea, TextField } from '@/components/Field';
import { useMuseumStore } from '@/store/museum';
import { useMuseumOps } from '@/store/ops';
import type { Project, ProjectStatus } from '@/types';
import { Artifact } from './Artifact';
import { ProjectPanel } from './ProjectPanel';
import { pickUps } from './pickup';
import './workshop.css';

type Shelf = 'bench' | 'active' | 'paused' | 'idea' | 'done' | 'abandoned';
const SHELVES: { id: Shelf; label: string }[] = [
  { id: 'bench', label: 'On the bench' },
  { id: 'active', label: 'In motion' },
  { id: 'paused', label: 'Resting' },
  { id: 'idea', label: 'Ideas' },
  { id: 'done', label: 'Finished' },
  { id: 'abandoned', label: 'Set aside' },
];

export default function Workshop() {
  const records = useMuseumStore((s) => s.records);
  const ops = useMuseumOps();
  const [params] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get('project'));
  const [shelf, setShelf] = useState<Shelf>('bench');
  const [starting, setStarting] = useState(false);
  const now = useMemo(() => Date.now(), [records]); // eslint-disable-line react-hooks/exhaustive-deps

  const { projects, actions, goals } = records;
  const selected = projects.find((p) => p.id === selectedId) ?? null;
  const picks = useMemo(() => pickUps(records, now), [records, now]);
  const pickById = new Map(picks.map((p) => [p.project.id, p.reasons]));

  const onShelf = projects
    .filter((p) => shelf === 'bench' ? p.status === 'active' || p.status === 'paused' || p.status === 'idea' : p.status === shelf)
    .sort((a, b) => order(a.status) - order(b.status) || b.lastVisitedAt - a.lastVisitedAt);
  const counts = (s: Shelf) => projects.filter((p) => s === 'bench' ? p.status === 'active' || p.status === 'paused' || p.status === 'idea' : p.status === s).length;
  const empty = projects.length === 0;

  const start = async (v: { title: string; summary: string; goalId: string; status: ProjectStatus }) => {
    const p = await ops.createProject({ title: v.title, summary: v.summary, goalIds: v.goalId ? [v.goalId] : [], status: v.status });
    setStarting(false);
    setSelectedId(p.id);
  };

  return (
    <section className={`ws ${empty ? 'ws--empty' : ''}`}>
      <div className="ws__room">
        <header className="ws__head">
          <div>
            <span className="plaque">Unfinished things</span>
            <h1 className="ws__title">Workshop</h1>
            <p className="ws__intent">Projects as things on a bench. Dust settles on what you have not touched. Nothing here is a debt.</p>
          </div>
          {!empty && !starting && <Instrument tone="primary" onClick={() => { setStarting(true); setSelectedId(null); }}>Start a project</Instrument>}
        </header>

        {empty ? (
          <div className="ws__invite">
            <span className="plaque">The bench is clear</span>
            <h2 className="ws__invite-title">Put the first thing on it.</h2>
            <p className="ws__invite-lede">A project is a bounded piece of work with an end. It can serve a goal from the Observatory, or stand on its own.</p>
            <StartForm goals={goals} onSubmit={start} />
          </div>
        ) : (
          <>
            {picks.length > 0 && (
              <section className="ws__table">
                <div className="ws__section-head">
                  <span className="plaque">Worth picking up · {picks.length}</span>
                  <span className="ws__rule">Chosen by plain rules: not touched lately, still has a next step, serves a goal in the sky, nearly done, or an idea that has waited. Each one says why.</span>
                </div>
                <ul className="ws__grid ws__grid--table">
                  {picks.map(({ project, reasons }) => (
                    <li key={project.id}>
                      <Artifact project={project} actions={actions.filter((a) => a.projectId === project.id)} goals={goals} selected={selectedId === project.id} now={now} reasons={reasons} onOpen={() => { setSelectedId(project.id); setStarting(false); }} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="ws__shelves">
              <div className="ws__section-head">
                <div className="shelves" role="tablist" aria-label="Shelves">
                  {SHELVES.map((s) => (
                    <button key={s.id} type="button" role="tab" aria-selected={shelf === s.id} className={`shelf ${shelf === s.id ? 'is-active' : ''}`} onClick={() => setShelf(s.id)}>
                      {s.label} <span className="shelf__n tabular">{counts(s.id)}</span>
                    </button>
                  ))}
                </div>
              </div>
              {onShelf.length === 0 ? (
                <p className="ws__empty-shelf">Nothing on this shelf.</p>
              ) : (
                <ul className="ws__grid">
                  {onShelf.map((p) => (
                    <li key={p.id}>
                      <Artifact project={p} actions={actions.filter((a) => a.projectId === p.id)} goals={goals} selected={selectedId === p.id} now={now} onOpen={() => { setSelectedId(p.id); setStarting(false); }} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      <aside className="ws__panel">
        {starting ? (
          <div className="panel">
            <button type="button" className="panel__back plaque" onClick={() => setStarting(false)}>← The bench</button>
            <header className="panel__head">
              <span className="plaque">A new thing</span>
              <h2 className="panel__title">Start a project</h2>
            </header>
            <StartForm goals={goals} onSubmit={start} onCancel={() => setStarting(false)} />
          </div>
        ) : selected ? (
          <ProjectPanel
            project={selected}
            records={records}
            ops={ops}
            now={now}
            {...(pickById.has(selected.id) ? { reasons: pickById.get(selected.id)! } : {})}
            onBack={() => setSelectedId(null)}
            onDeleted={() => setSelectedId(null)}
          />
        ) : (
          <div className="panel">
            <header className="panel__head">
              <span className="plaque">How the bench works</span>
              <h2 className="panel__title">{empty ? 'Things, not tasks' : 'Pick something up'}</h2>
            </header>
            <ol className="guide">
              <li><strong>Each project</strong> is one object: what it is, which goal it serves, how far along, when you last touched it, and the smallest next step.</li>
              <li><strong>Dust</strong> gathers on what rests. It is information, not a verdict.</li>
              <li><strong>The table</strong> at the top holds a few projects worth picking up, chosen by stated rules, each with its reason.</li>
              <li><strong>Shelves</strong> hold everything by state: in motion, resting, ideas, finished, set aside.</li>
            </ol>
            {!empty && <p className="panel__empty">Choose any object to read it, edit it, change its state, or work its next steps. Everything here is the same data the Observatory draws as stars.</p>}
          </div>
        )}
      </aside>
    </section>
  );
}

function StartForm({ goals, onSubmit, onCancel }: { goals: { id: string; title: string; state: string }[]; onSubmit: (v: { title: string; summary: string; goalId: string; status: ProjectStatus }) => Promise<void>; onCancel?: () => void }) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [goalId, setGoalId] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [busy, setBusy] = useState(false);
  const inSky = goals.filter((g) => g.state === 'active' || g.state === 'dormant');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try { await onSubmit({ title: title.trim(), summary: summary.trim(), goalId, status }); } finally { setBusy(false); }
  };
  return (
    <form className="goal-form" onSubmit={submit}>
      <TextField label="Project" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Something with an end" maxLength={120} required autoFocus />
      <TextArea label="What it is" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One or two lines." rows={2} maxLength={600} />
      <SelectField label="Serves" value={goalId} onChange={(e) => setGoalId(e.target.value)} {...(inSky.length ? {} : { hint: 'No goals in the sky yet; it can stand alone.' })}>
        <option value="">No goal, for now</option>
        {inSky.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
      </SelectField>
      <SelectField label="Starts as" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
        <option value="active">In motion</option>
        <option value="idea">An idea</option>
        <option value="paused">Resting</option>
      </SelectField>
      <div className="form-actions">
        <Instrument tone="primary" type="submit" disabled={busy || !title.trim()}>Put it on the bench</Instrument>
        {onCancel && <Instrument tone="quiet" type="button" onClick={onCancel}>Cancel</Instrument>}
      </div>
    </form>
  );
}

function order(s: Project['status']) { return ({ active: 0, paused: 1, idea: 2, done: 3, abandoned: 4 })[s]; }

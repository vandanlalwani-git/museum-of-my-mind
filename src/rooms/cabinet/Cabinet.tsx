import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Instrument } from '@/components/Instrument';
import { SelectField, TextField } from '@/components/Field';
import { makeThread, touched } from '@/data/factories';
import { relativeAge } from '@/lib/dates';
import { paragraphs } from '@/lib/text';
import { useMuseumStore } from '@/store/museum';
import { useMuseumOps, STATUS_LABEL } from '@/store/ops';
import { useUiStore } from '@/store/ui';
import { THREAD_LABEL, type Link, type Memory, type Project, type RecordType } from '@/types';
import { curiosities, type CabinetItem, type Curiosity } from './rules';
import './cabinet.css';

const KIND_LABEL = { note: 'A thought', idea: 'An idea', link: 'A link', memory: 'A memory', project: 'A resting project' } as const;
const REST_DAYS = 60;
const DAY = 86_400_000;

function typeOf(item: CabinetItem): RecordType {
  if ('status' in item) return 'projects';
  if ('url' in item) return 'links';
  if ('occurredAt' in item) return 'memories';
  return 'notes';
}

export default function Cabinet() {
  const museumId = useMuseumStore((s) => s.activeMuseumId)!;
  const records = useMuseumStore((s) => s.records);
  const upsert = useMuseumStore((s) => s.upsert);
  const say = useUiStore((s) => s.say);
  const ops = useMuseumOps();

  const [now] = useState(() => Date.now());
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<'view' | 'project' | 'step'>('view');

  const drawer = useMemo(() => curiosities(records, now, { exclude: skipped, seed: museumId }), [records, now, skipped, museumId]);
  const current: Curiosity | null = drawer[Math.min(index, Math.max(0, drawer.length - 1))] ?? null;
  useEffect(() => { if (index >= drawer.length) setIndex(0); }, [drawer.length, index]);
  useEffect(() => { setMode('view'); }, [current?.id]);

  const titles = useMemo(() => {
    const m = new Map<string, { title: string; to: string }>();
    for (const n of records.notes) m.set(n.id, { title: n.title, to: `/archive?item=${n.id}` });
    for (const l of records.links) m.set(l.id, { title: l.title, to: `/archive?item=${l.id}` });
    for (const mem of records.memories) m.set(mem.id, { title: mem.title, to: `/archive?item=${mem.id}` });
    for (const g of records.goals) m.set(g.id, { title: g.title, to: `/observatory?goal=${g.id}` });
    for (const p of records.projects) m.set(p.id, { title: p.title, to: `/workshop?project=${p.id}` });
    return m;
  }, [records]);

  const showElse = () => {
    if (!current) return;
    setSkipped((s) => new Set([...s, current.id]));
    setIndex(0);
  };
  const stillInteresting = async () => {
    if (!current) return;
    await upsert(typeOf(current.item), { ...current.item, lastVisitedAt: now } as never);
    say('Noted. It counts as opened, and will come back around in a while.');
    setSkipped((s) => new Set([...s, current.id]));
  };
  const putAway = async () => {
    if (!current) return;
    await upsert(typeOf(current.item), { ...current.item, restUntil: now + REST_DAYS * DAY } as never);
    say(`Put away for ${REST_DAYS} days. Nothing else about it changes.`);
  };
  const archive = async () => {
    if (!current) return;
    if (current.kind === 'project') {
      await ops.setProjectStatus(current.item as Project, 'abandoned');
    } else {
      await upsert(typeOf(current.item), touched(current.item, { archivedAt: now } as never) as never);
      say('Archived. It leaves the wall and the drawers, but stays searchable in the Archive.');
    }
  };
  const setInMotion = async () => { if (current?.kind === 'project') await ops.setProjectStatus(current.item as Project, 'active'); };

  const makeProject = async (v: { title: string; goalId: string }) => {
    if (!current) return;
    const p = await ops.createProject({ title: v.title, summary: `From “${current.title}”.`, goalIds: v.goalId ? [v.goalId] : [], tags: current.item.tags });
    await upsert('threads', makeThread(museumId, p.id, current.id, 'inspired-by', 'Started from the Cabinet.'));
    await upsert(typeOf(current.item), { ...current.item, lastVisitedAt: now } as never);
    say('A project now sits on the bench, with a thread back to where it came from.');
    setMode('view');
  };
  const addStep = async (v: { projectId: string; text: string }) => {
    if (!current) return;
    await ops.addAction(v.projectId, v.text);
    if (!records.threads.some((t) => (t.fromId === current.id && t.toId === v.projectId))) {
      await upsert('threads', makeThread(museumId, current.id, v.projectId, 'supports', 'Became a next step from the Cabinet.'));
    }
    await upsert(typeOf(current.item), { ...current.item, lastVisitedAt: now } as never);
    say('Added as a next step. The Workshop and Observatory both see it.');
    setMode('view');
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % Math.max(1, drawer.length));
    if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + Math.max(1, drawer.length)) % Math.max(1, drawer.length));
  };

  const activeProjects = records.projects.filter((p) => p.status === 'active');
  const inSky = records.goals.filter((g) => g.state === 'active' || g.state === 'dormant');
  const nothingAtAll = records.notes.length + records.links.length + records.memories.length + records.projects.length === 0;

  return (
    <section className="cab" onKeyDown={onKey}>
      <header className="cab__head">
        <span className="plaque">What you forgot</span>
        <h1 className="cab__title">Cabinet of Curiosities</h1>
        <p className="cab__intent">One drawer at a time. Each thing here was chosen by a rule you can read, never by a guess about you.</p>
      </header>

      {!current ? (
        <div className="cab__quiet">
          <span className="plaque">The drawers are quiet</span>
          <h2 className="cab__quiet-title">{nothingAtAll ? 'Nothing has been put away yet.' : 'Nothing is waiting to be found.'}</h2>
          <p className="cab__quiet-lede">
            {nothingAtAll
              ? 'The Cabinet fills itself from the Archive and the Workshop: notes, links, memories, and projects you have not opened in a while. Keep a few things and come back.'
              : skipped.size > 0
                ? 'You have seen everything the rules would offer today. Tomorrow the drawer opens elsewhere.'
                : 'Everything is either fresh, archived, or resting. That is a good sign.'}
          </p>
          <div className="form-actions">
            <RouterLink to="/archive" className="instrument">The Archive</RouterLink>
            <RouterLink to="/workshop" className="instrument">The Workshop</RouterLink>
            {skipped.size > 0 && <Instrument tone="quiet" onClick={() => setSkipped(new Set())}>Open the drawer again</Instrument>}
          </div>
        </div>
      ) : (
        <>
          <article className="drawer" aria-live="polite" tabIndex={-1} key={current.id}>
            <div className="drawer__lip" aria-hidden="true" />
            <header className="drawer__head">
              <span className="plaque">{KIND_LABEL[current.kind]} · kept {relativeAge(current.item.createdAt, now)} · opened {relativeAge(current.item.lastVisitedAt, now)}</span>
              <h2 className="drawer__title">{current.title}</h2>
              {current.kind === 'link' && <p className="arc-url"><a href={(current.item as Link).url} target="_blank" rel="noopener noreferrer">{(current.item as Link).url}</a></p>}
              {current.kind === 'memory' && <p className="plaque">Happened {new Date((current.item as Memory).occurredAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
              {current.kind === 'project' && <p className="plaque">{STATUS_LABEL[(current.item as Project).status]} · {Math.round((current.item as Project).progress * 100)}% · {nextStep(current.item as Project, records) ?? 'no next step named'}</p>}
            </header>
            <Body item={current.item} />
            {current.item.tags.length > 0 && <p className="drawer__tags plaque">{current.item.tags.join(' · ')}</p>}
            <Threads id={current.id} records={records} titles={titles} />

            <div className="drawer__why">
              <span className="plaque">Why this drawer opened</span>
              <ul>{current.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>

            {mode === 'project' && (
              <ProjectForm defaultTitle={current.title} goals={inSky} onSubmit={makeProject} onCancel={() => setMode('view')} />
            )}
            {mode === 'step' && (
              <StepForm defaultText={current.title} projects={activeProjects} onSubmit={addStep} onCancel={() => setMode('view')} />
            )}

            {mode === 'view' && (
              <div className="drawer__actions">
                <RouterLink to={current.kind === 'project' ? `/workshop?project=${current.id}` : `/archive?item=${current.id}`} className="instrument instrument--primary">Open it</RouterLink>
                <Instrument onClick={() => void stillInteresting()}>Still interesting</Instrument>
                {current.kind === 'project'
                  ? <Instrument onClick={() => void setInMotion()}>Set it in motion</Instrument>
                  : <>
                      <Instrument onClick={() => setMode('project')}>Make it a project</Instrument>
                      {activeProjects.length > 0 && <Instrument onClick={() => setMode('step')}>Add as a next step</Instrument>}
                    </>}
                <Instrument tone="quiet" onClick={() => void putAway()}>Put it away for {REST_DAYS} days</Instrument>
                <Instrument tone="quiet" onClick={() => void archive()}>{current.kind === 'project' ? 'Set it aside' : 'Archive it'}</Instrument>
                <Instrument tone="quiet" onClick={showElse}>Show something else</Instrument>
              </div>
            )}
          </article>

          {drawer.length > 1 && (
            <nav className="cab__also" aria-label="Also in the drawer">
              <span className="plaque">Also in the drawer</span>
              <ul>
                {drawer.map((c, i) => (
                  <li key={c.id}>
                    <button type="button" className={`cab__also-item ${i === index ? 'is-current' : ''}`} aria-current={i === index ? 'true' : undefined} onClick={() => setIndex(i)}>
                      <span className="plaque">{KIND_LABEL[c.kind]}</span>
                      <span className="display">{c.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="cab__hint">Arrow keys move between drawers.</p>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

function nextStep(p: Project, records: { actions: { projectId: string; doneAt?: number; text: string; createdAt: number }[] }): string | undefined {
  return records.actions.filter((a) => a.projectId === p.id && !a.doneAt).sort((a, b) => a.createdAt - b.createdAt)[0]?.text;
}

function Body({ item }: { item: CabinetItem }) {
  const text = 'status' in item ? item.summary : 'url' in item ? item.whySaved : item.body;
  if (!text) return null;
  return (
    <div className="drawer__body">
      {paragraphs(text).map((lines, i) => <p key={i}>{lines.map((l, j) => <span key={j}>{l}{j < lines.length - 1 && <br />}</span>)}</p>)}
    </div>
  );
}

function Threads({ id, records, titles }: { id: string; records: { threads: { id: string; fromId: string; toId: string; kind: keyof typeof THREAD_LABEL; why?: string }[] }; titles: Map<string, { title: string; to: string }> }) {
  const threads = records.threads.filter((t) => t.fromId === id || t.toId === id);
  if (!threads.length) return null;
  return (
    <ul className="drawer__threads">
      {threads.map((t) => {
        const outgoing = t.fromId === id;
        const other = titles.get(outgoing ? t.toId : t.fromId);
        return (
          <li key={t.id} className="thread__line">
            {outgoing ? <em>This</em> : (other ? <RouterLink className="thread__target" to={other.to}>{other.title}</RouterLink> : <span>something gone</span>)}
            {' '}<span className="thread__kind">{THREAD_LABEL[t.kind]}</span>{' '}
            {outgoing ? (other ? <RouterLink className="thread__target" to={other.to}>{other.title}</RouterLink> : <span>something gone</span>) : <em>this</em>}
            {t.why && <span className="drawer__thread-why"> — “{t.why}”</span>}
          </li>
        );
      })}
    </ul>
  );
}

function ProjectForm({ defaultTitle, goals, onSubmit, onCancel }: { defaultTitle: string; goals: { id: string; title: string }[]; onSubmit: (v: { title: string; goalId: string }) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState(defaultTitle);
  const [goalId, setGoalId] = useState('');
  return (
    <form className="goal-form drawer__form" onSubmit={(e: FormEvent) => { e.preventDefault(); if (title.trim()) void onSubmit({ title: title.trim(), goalId }); }}>
      <TextField label="Project" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required autoFocus />
      <SelectField label="Serves" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
        <option value="">No goal, for now</option>
        {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
      </SelectField>
      <div className="form-actions">
        <Instrument tone="primary" type="submit" disabled={!title.trim()}>Put it on the bench</Instrument>
        <Instrument tone="quiet" type="button" onClick={onCancel}>Cancel</Instrument>
      </div>
    </form>
  );
}

function StepForm({ defaultText, projects, onSubmit, onCancel }: { defaultText: string; projects: { id: string; title: string }[]; onSubmit: (v: { projectId: string; text: string }) => Promise<void>; onCancel: () => void }) {
  const [text, setText] = useState(defaultText);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  return (
    <form className="goal-form drawer__form" onSubmit={(e: FormEvent) => { e.preventDefault(); if (text.trim() && projectId) void onSubmit({ projectId, text: text.trim() }); }}>
      <TextField label="Next step" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} required autoFocus />
      <SelectField label="For the project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      </SelectField>
      <div className="form-actions">
        <Instrument tone="primary" type="submit" disabled={!text.trim() || !projectId}>Add the step</Instrument>
        <Instrument tone="quiet" type="button" onClick={onCancel}>Cancel</Instrument>
      </div>
    </form>
  );
}

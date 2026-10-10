import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addDays, dayKey, parseDayKey, startOfDay } from '@/mind/calendar';
import { mindOps } from '@/mind/ops';
import { describeRepeat, isDue, nextDue } from '@/mind/recurrence';
import { progressOf, stepsOf, thoughtsForProject } from '@/mind/select';
import { SHAPE_WORDS, daysUntil, recentPace, recentWeeks, whatIfDate } from '@/mind/shapes';
import { useMind } from '@/mind/store';
import type { Project, ProjectShape, Step } from '@/mind/types';
import { useCapture, useFocus } from '@/shell/focus';
import { BackIcon } from '@/shell/icons';
import { PlanetGlyph } from '@/shell/Glyphs';
import { HomePicker } from '@/shell/HomePicker';
import { useUiStore } from '@/store/ui';
import { STEP_KIND_WORDS, ShapeFields, StepForm, type StepDraft } from '../shared/forms';
import { ThoughtList } from '../shared/ThoughtList';
import { longDay, monthOnly, shortDay } from '../shared/words';
import '../shared/pages.css';

export default function ProjectPage() {
  const { id = '' } = useParams();
  const snap = useMind((s) => s.snap);
  const setFocus = useFocus((s) => s.setFocus);
  const project = snap?.projects.find((p) => p.id === id && !p.deletedAt);
  const projectId = project?.id, goalId = project?.goalId ?? null, galaxyId = project?.galaxyId;
  useEffect(() => {
    if (projectId && galaxyId) { setFocus({ galaxyId, goalId, projectId }); void mindOps.visit('projects', projectId); }
  }, [projectId, goalId, galaxyId, setFocus]);
  if (!snap) return null;
  if (!project) {
    return (
      <div className="place plate">
        <p className="place__eyebrow">Not here</p>
        <h1 className="place__title">This project is not in this museum</h1>
        <Link to="/" className="instrument">Back to the sky</Link>
      </div>
    );
  }
  return <ProjectView project={project} />;
}

function ProjectView({ project }: { project: Project }) {
  const snap = useMind((s) => s.snap)!;
  const openCapture = useCapture((s) => s.openCapture);
  const say = useUiStore((s) => s.say);
  const [adding, setAdding] = useState(false);
  const [reshaping, setReshaping] = useState(false);
  const [moving, setMoving] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const goal = project.goalId ? snap.goals.find((g) => g.id === project.goalId) : undefined;
  const galaxy = snap.galaxies.find((g) => g.id === project.galaxyId);
  const steps = stepsOf(snap, project.id);
  const progress = progressOf(snap, project);
  const thoughts = thoughtsForProject(snap, project.id);
  const shape = project.shape;
  const counting = shape.kind === 'number' || shape.kind === 'habit';

  const isDone = (s: Step) => (s.kind === 'once' || s.kind === 'milestone' || s.kind === 'waiting' || s.kind === 'someday') && s.doneAt !== undefined;
  const open = steps.filter((s) => !isDone(s) && s.kind !== 'someday');
  const someday = steps.filter((s) => s.kind === 'someday' && !isDone(s));
  const done = steps.filter(isDone);
  const log = steps.flatMap((s) => s.log.map((c) => ({ ...c, text: s.text }))).sort((a, b) => b.at - a.at);

  const addStep = async (d: StepDraft) => {
    await mindOps.addStep({ projectId: project.id, ...d });
    say(d.kind === 'repeat' ? 'A repeating step. It shows on Today only when it is due.' : 'Added.');
  };

  return (
    <article className="place plate">
      <Link to={goal ? `/goal/${goal.id}` : galaxy ? `/?galaxy=${galaxy.id}` : '/'} className="back-link"><BackIcon />{goal?.title ?? galaxy?.name ?? 'The sky'}</Link>
      <header className="place__head">
        <p className="place__eyebrow">Project · {SHAPE_WORDS[shape.kind]}{project.state !== 'active' ? ` · ${project.state}` : ''}</p>
        <h1 className="place__title">{project.title}</h1>
        {project.summary && <p className="place__lede">{project.summary}</p>}
      </header>

      <div className="hero">
        <PlanetGlyph progress={progress} shape={shape.kind} size={120} />
        <Figure project={project} />
      </div>

      {shape.kind === 'number' && <Pace project={project} steps={steps} done={progress.done} target={shape.target} />}
      {shape.kind === 'habit' && <HabitWeeks steps={steps} perWeek={shape.perWeek} />}
      {shape.kind === 'levels' && <Ladder project={project} shape={shape} />}
      {shape.kind === 'explore' && <Conclusion project={project} shape={shape} />}

      <section className="place__section">
        <h2 className="place__h2">Steps <button type="button" onClick={() => setAdding((v) => !v)}>{adding ? 'Close' : 'Add a step'}</button></h2>
        {adding && <StepForm onSave={(d) => void addStep(d)} onCancel={() => setAdding(false)} suggestRepeat={counting && steps.every((s) => s.kind !== 'repeat')} />}
        {open.length === 0 && !adding && <p className="place__empty">{counting ? 'Add a repeating step, such as “Draw one page, every evening”. Each tick counts.' : 'What is the smallest next step?'}</p>}
        {open.length > 0 && <ul className="steps">{open.map((s) => <StepRow key={s.id} step={s} project={project} />)}</ul>}
        {someday.length > 0 && (
          <>
            <h3 className="place__h2">Someday</h3>
            <ul className="steps">{someday.map((s) => <StepRow key={s.id} step={s} project={project} />)}</ul>
          </>
        )}
        {done.length > 0 && (
          <>
            <button type="button" className="quiet-btn done-toggle" onClick={() => setShowDone((v) => !v)}>{showDone ? 'Hide' : 'Show'} {done.length} done</button>
            {showDone && <ul className="steps">{done.map((s) => <StepRow key={s.id} step={s} project={project} />)}</ul>}
          </>
        )}
      </section>

      {log.length > 0 && counting && (
        <section className="place__section">
          <h2 className="place__h2">{shape.kind === 'number' ? 'So far' : 'Recently'}</h2>
          <ul className="log">
            {log.slice(0, 8).map((c, i) => <li key={`${c.at}-${i}`}><span>{c.note ?? c.text}{c.amount && c.amount !== 1 ? ` · ${c.amount}` : ''}</span><span>{shortDay(c.at)}</span></li>)}
          </ul>
        </section>
      )}

      <section className="place__section">
        <h2 className="place__h2">On your mind <button type="button" onClick={() => openCapture({ projectId: project.id })}>Add a thought</button></h2>
        <ThoughtList thoughts={thoughts} empty={shape.kind === 'explore' ? 'Gather what you notice and learn here. Each thought brightens the planet.' : 'Nothing yet.'} />
      </section>

      {reshaping && (
        <Reshape project={project} onDone={() => setReshaping(false)} />
      )}
      {moving && (
        <div className="newproject">
          <HomePicker mode="parent" prompt="Which goal does it serve? Or keep it in a galaxy with no goal yet." onPick={(t) => {
            const g = t.kind === 'goal' ? snap.goals.find((x) => x.id === t.id) : undefined;
            void mindOps.updateProject(project.id, { goalId: g ? g.id : null, galaxyId: g ? g.galaxyId : t.id }).then(() => { setMoving(false); say(`Now ${g ? `orbiting ${g.title}` : `in ${t.title}`}.`); });
          }} onCancel={() => setMoving(false)} />
        </div>
      )}

      <footer className="page-foot">
        {project.state === 'active' || project.state === 'idea' ? (
          <>
            <button type="button" className="quiet-btn" onClick={() => void mindOps.updateProject(project.id, { state: 'finished' }).then(() => say('Finished. It settles into a quiet orbit.'))}>Mark as finished</button>
            <button type="button" className="quiet-btn" onClick={() => void mindOps.updateProject(project.id, { state: 'paused' }).then(() => say('Paused. Nothing from it reaches Today.'))}>Pause</button>
          </>
        ) : (
          <button type="button" className="quiet-btn" onClick={() => void mindOps.updateProject(project.id, { state: 'active' }).then(() => say('Moving again.'))}>Make it active again</button>
        )}
        <button type="button" className="quiet-btn" onClick={() => setReshaping((v) => !v)}>Change its shape</button>
        <button type="button" className="quiet-btn" onClick={() => setMoving((v) => !v)}>Move it</button>
        {project.state !== 'dropped' && <button type="button" className="quiet-btn" onClick={() => void mindOps.updateProject(project.id, { state: 'dropped' }).then(() => say('Dropped. It stays in Search if you ever want it.'))}>Drop it</button>}
      </footer>
    </article>
  );
}

function Figure({ project }: { project: Project }) {
  const snap = useMind((s) => s.snap)!;
  const p = progressOf(snap, project);
  const s = project.shape;
  let figure = '', sub = '';
  switch (s.kind) {
    case 'list': figure = p.total ? `${p.done} of ${p.total}` : 'No steps yet'; sub = p.total ? 'steps done · finished when all are' : 'Add the steps it takes'; break;
    case 'number': figure = `${p.done} of ${s.target}`; sub = s.unit; break;
    case 'habit': figure = `${p.done} of ${s.perWeek}`; sub = 'this week'; break;
    case 'date': { const d = daysUntil(project, Date.now()); const day = parseDayKey(s.date); figure = d === null ? 'No date' : d > 1 ? `In ${d} days` : d === 1 ? 'Tomorrow' : d === 0 ? 'Today' : 'The day has passed'; sub = day ? `${longDay(day)}${p.total ? ` · ${p.done} of ${p.total} steps ready` : ''}` : ''; break; }
    case 'levels': figure = s.reached >= s.levels.length ? 'Every level reached' : `Level ${s.reached + 1} of ${s.levels.length}`; sub = s.levels[Math.min(s.reached, s.levels.length - 1)] ?? ''; break;
    case 'explore': figure = s.conclusion ? 'Concluded' : `${p.done} ${p.done === 1 ? 'thought' : 'thoughts'} gathered`; sub = s.question; break;
  }
  return (
    <div>
      <p className="hero__figure">{figure}</p>
      <p className="hero__sub">{sub}</p>
      {s.kind === 'habit' && <WeekDots steps={stepsOf(snap, project.id)} perWeek={s.perWeek} />}
    </div>
  );
}

function WeekDots({ steps, perWeek }: { steps: Step[]; perWeek: number }) {
  const n = recentWeeks(steps, Date.now(), 1)[0] ?? 0;
  return <div className="weekdots" aria-label={`${n} of ${perWeek} this week`}>{Array.from({ length: Math.min(perWeek, 14) }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}</div>;
}

/** "If you keep this pace": a what-if, never a promise. */
function Pace({ steps, done, target }: { project: Project; steps: Step[]; done: number; target: number }) {
  const left = target - done;
  if (left <= 0) return <div className="pace"><p className="hero__sub">The target is reached. You could raise it, or mark the project finished.</p></div>;
  const today = startOfDay(Date.now());
  const pace = recentPace(steps, Date.now());
  const rows: [string, string][] = [];
  if (pace) {
    const d = whatIfDate(left, pace, today);
    rows.push([`Your recent pace (about ${pace < 1 ? `${Math.round(pace * 4.33)} a month` : `${Math.round(pace * 10) / 10} a week`})`, d ? `about ${monthOnly(d)}` : '—']);
  }
  for (const r of [1, 2]) { const d = whatIfDate(left, r, today); if (d && (!pace || Math.abs(pace - r) > 0.3)) rows.push([r === 1 ? 'One a week' : 'Two a week', `about ${monthOnly(d)}`]); }
  return (
    <section className="pace" aria-label="If you keep this pace">
      <h2 className="place__h2">If you keep this pace</h2>
      {rows.map(([a, b]) => <div key={a} className="pace__row"><span>{a}</span><span>{b}</span></div>)}
      <p className="meta">{left} to go. A what-if, not a promise.</p>
    </section>
  );
}

function HabitWeeks({ steps, perWeek }: { steps: Step[]; perWeek: number }) {
  const weeks = recentWeeks(steps, Date.now(), 6);
  const kept = weeks.slice(0, -1).filter((n) => n >= perWeek).length;
  const partly = weeks.slice(0, -1).filter((n) => n > 0 && n < perWeek).length;
  return (
    <section className="pace" aria-label="The last six weeks">
      <h2 className="place__h2">The last six weeks</h2>
      <div className="weeks">{weeks.map((n, i) => <i key={i} className={i === weeks.length - 1 ? 'now' : ''} style={{ height: `${Math.max(4, Math.min(1, n / perWeek) * 100)}%` }} />)}</div>
      <div className="weeks__labels">{weeks.map((_, i) => <span key={i}>{i === weeks.length - 1 ? 'now' : `${weeks.length - 1 - i}w`}</span>)}</div>
      <p className="meta">{kept} kept in full{partly ? `, ${partly} partly` : ''}. Partial weeks still count.</p>
    </section>
  );
}

function Ladder({ project, shape }: { project: Project; shape: Extract<ProjectShape, { kind: 'levels' }> }) {
  const say = useUiStore((s) => s.say);
  const up = (n: number) => void mindOps.updateProject(project.id, { shape: { ...shape, reached: Math.max(0, Math.min(shape.levels.length, n)) } });
  return (
    <section className="place__section">
      <ol className="ladder">
        {shape.levels.map((l, i) => <li key={l} className={i < shape.reached ? 'reached' : i === shape.reached ? 'next' : ''}>{l}</li>)}
      </ol>
      <div className="form-actions">
        {shape.reached < shape.levels.length && <button type="button" className="instrument instrument--primary" onClick={() => { up(shape.reached + 1); say(`Reached: ${shape.levels[shape.reached]}.`); }}>I reached “{shape.levels[shape.reached]}”</button>}
        {shape.reached > 0 && <button type="button" className="instrument instrument--quiet" onClick={() => up(shape.reached - 1)}>Step back a level</button>}
      </div>
    </section>
  );
}

function Conclusion({ project, shape }: { project: Project; shape: Extract<ProjectShape, { kind: 'explore' }> }) {
  const [text, setText] = useState(shape.conclusion ?? '');
  const [editing, setEditing] = useState(!shape.conclusion);
  const say = useUiStore((s) => s.say);
  if (!editing && shape.conclusion) {
    return (
      <section className="place__section">
        <h2 className="place__h2">What I concluded <button type="button" onClick={() => setEditing(true)}>Change it</button></h2>
        <p className="page-why">{shape.conclusion}</p>
      </section>
    );
  }
  return (
    <form className="place__section" onSubmit={(e) => { e.preventDefault(); void mindOps.updateProject(project.id, { shape: { ...shape, ...(text.trim() ? { conclusion: text.trim() } : {}) } }).then(() => { setEditing(false); if (text.trim()) say('Concluded. The planet’s ring closes.'); }); }}>
      <h2 className="place__h2">When you know what you think</h2>
      <textarea className="field__input field__textarea" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write it down, even if it is “not yet”." aria-label="What you concluded" />
      <div className="form-actions"><button type="submit" className="instrument" disabled={!text.trim()}>Keep this conclusion</button></div>
    </form>
  );
}

function Reshape({ project, onDone }: { project: Project; onDone: () => void }) {
  const [shape, setShape] = useState<ProjectShape | null>(project.shape);
  const [title, setTitle] = useState(project.title);
  const [summary, setSummary] = useState(project.summary);
  return (
    <form className="newproject" onSubmit={(e) => { e.preventDefault(); if (shape && title.trim()) void mindOps.updateProject(project.id, { shape, title: title.trim(), summary: summary.trim() }).then(onDone); }}>
      <label className="field"><span className="plaque">Name</span><input className="field__input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="field"><span className="plaque">A line about it (optional)</span><input className="field__input" value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
      <ShapeFields value={shape} onChange={setShape} title={title} />
      <div className="form-actions">
        <button type="submit" className="instrument instrument--primary" disabled={!shape || !title.trim()}>Save</button>
        <button type="button" className="instrument instrument--quiet" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function StepRow({ step, project }: { step: Step; project: Project }) {
  const say = useUiStore((s) => s.say);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const today = startOfDay(Date.now());
  const repeating = step.kind === 'repeat' || step.kind === 'session';
  const todayKey = dayKey(today);
  const doneToday = repeating && step.log.some((c) => dayKey(c.at) === todayKey);
  const done = !repeating && step.doneAt !== undefined;

  const check = async () => {
    if (repeating) {
      if (doneToday) { await mindOps.undoStep(step.id); return; }
      await mindOps.completeStep(step.id, step.amount ? { amount: step.amount.per } : {});
      setNoting(project.shape.kind === 'number' || step.kind === 'session');
      say(project.shape.kind === 'number' ? 'Counted.' : 'Done for today.');
    } else if (done) {
      await mindOps.undoStep(step.id);
    } else {
      await mindOps.completeStep(step.id);
      say(step.kind === 'milestone' ? 'A milestone. Worth a line in your journal.' : 'Done.');
    }
  };
  const saveNote = async () => {
    // Read the latest copy: the tick that this note belongs to was just written.
    const fresh = useMind.getState().snap?.steps.find((s) => s.id === step.id);
    if (!fresh || !note.trim()) { setNoting(false); return; }
    const i = fresh.log.length - 1;
    await mindOps.updateStep(step.id, { log: fresh.log.map((c, j) => (j === i ? { ...c, note: note.trim() } : c)) });
    setNote(''); setNoting(false);
  };

  let meta: string = STEP_KIND_WORDS[step.kind];
  if (repeating) {
    const rule = describeRepeat(step);
    const next = doneToday ? nextDue(step, addDays(today, 1)) : isDue(step, today) ? today : nextDue(step, today);
    meta = `${rule}${step.amount ? ` · ${step.amount.per} ${step.amount.unit}` : ''} · ${doneToday ? 'done today' : next && dayKey(next) === todayKey ? 'today' : next ? `next ${shortDay(next)}` : ''}`;
  } else if (step.kind === 'waiting') meta = `Waiting${step.waitingOn ? ` on ${step.waitingOn}` : ''} · never nags`;
  else if (step.kind === 'someday') meta = 'Someday · never reaches Today';
  if (done) meta = `Done ${shortDay(step.doneAt!)}`;

  if (editing) {
    return (
      <li className="step" style={{ display: 'block' }}>
        <StepForm
          initial={{ text: step.text, kind: step.kind, ...(step.repeat ? { repeat: step.repeat } : {}), ...(step.waitingOn ? { waitingOn: step.waitingOn } : {}), ...(step.amount ? { amount: step.amount } : {}) }}
          onSave={(d) => void mindOps.updateStep(step.id, { text: d.text.trim(), kind: d.kind, ...(d.repeat ? { repeat: d.repeat } : {}), ...(d.waitingOn ? { waitingOn: d.waitingOn } : {}), ...(d.amount ? { amount: d.amount } : {}) }).then(() => setEditing(false))}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className={`step step--${step.kind} ${done || doneToday ? 'step--done' : ''}`}>
      <button type="button" className="step__check" onClick={() => void check()} aria-label={done || doneToday ? `Undo: ${step.text}` : `Done: ${step.text}`} aria-pressed={done || doneToday} />
      <div className="step__body">
        <span className="step__text">{step.text}</span>
        <span className="meta">{meta}</span>
        {noting && (
          <form className="step__note" onSubmit={(e) => { e.preventDefault(); void saveNote(); }}>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="A few words? (optional)" aria-label="A note about this one" autoFocus />
            <button type="submit" className="linkish">Keep</button>
          </form>
        )}
      </div>
      <div className="step__more">
        <button type="button" className="quiet-btn" onClick={() => setEditing(true)}>Edit</button>
        <button type="button" className="quiet-btn" aria-label={`Remove: ${step.text}`} onClick={() => void mindOps.removeStep(step.id).then(() => say('Removed.'))}>×</button>
      </div>
    </li>
  );
}

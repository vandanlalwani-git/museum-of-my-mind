import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { dayKey, startOfWeek } from '@/mind/calendar';
import { mindOps } from '@/mind/ops';
import { journalFor, progressOf, projectsOf, thoughtsForGoal } from '@/mind/select';
import { SHAPE_WORDS } from '@/mind/shapes';
import { useMind } from '@/mind/store';
import type { Goal, Project, ProjectShape } from '@/mind/types';
import { useCapture, useFocus } from '@/shell/focus';
import { BackIcon } from '@/shell/icons';
import { PlanetGlyph } from '@/shell/Glyphs';
import { useUiStore } from '@/store/ui';
import { ShapeFields } from '../shared/forms';
import { ThoughtList } from '../shared/ThoughtList';
import { HORIZON_WORDS, longDay, monthYear } from '../shared/words';
import '../shared/pages.css';

/** Everything about one goal, on one page: why, the thoughts around it, its planets, its journal. */
export default function GoalPage() {
  const { id = '' } = useParams();
  const snap = useMind((s) => s.snap);
  const setFocus = useFocus((s) => s.setFocus);
  const goal = snap?.goals.find((g) => g.id === id && !g.deletedAt);
  const goalId = goal?.id, galaxyId = goal?.galaxyId;
  useEffect(() => {
    if (goalId && galaxyId) { setFocus({ galaxyId, goalId }); void mindOps.visit('goals', goalId); }
  }, [goalId, galaxyId, setFocus]);
  if (!snap) return null;
  if (!goal) return <Missing />;
  return <GoalView goal={goal} />;
}

function Missing() {
  return (
    <div className="place plate">
      <p className="place__eyebrow">Not here</p>
      <h1 className="place__title">This goal is not in this museum</h1>
      <Link to="/" className="instrument">Back to the sky</Link>
    </div>
  );
}

function GoalView({ goal }: { goal: Goal }) {
  const snap = useMind((s) => s.snap)!;
  const navigate = useNavigate();
  const openCapture = useCapture((s) => s.openCapture);
  const say = useUiStore((s) => s.say);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const galaxy = snap.galaxies.find((g) => g.id === goal.galaxyId);
  const thoughts = thoughtsForGoal(snap, goal.id);
  const projects = projectsOf(snap, goal.id);
  const current = projects.filter((p) => p.state === 'active' || p.state === 'idea' || p.state === 'paused');
  const past = projects.filter((p) => p.state === 'finished' || p.state === 'dropped');
  const journal = journalFor(snap, { goalId: goal.id }).slice(0, 4);
  const week = dayKey(startOfWeek(Date.now()));
  const review = snap.reviews.find((r) => r.weekStart === week && !r.deletedAt);
  const focused = review?.focusGoalIds.includes(goal.id) ?? false;

  const toggleFocus = async () => {
    const now = review?.focusGoalIds ?? [];
    const next = focused ? now.filter((x) => x !== goal.id) : [...now.filter((x) => x !== goal.id), goal.id].slice(-2);
    await mindOps.saveReview({ weekStart: week, focusGoalIds: next });
    say(focused ? 'Taken out of this week’s focus.' : 'Today will show this goal this week.');
  };

  return (
    <article className="place plate">
      <Link to={galaxy ? `/?galaxy=${galaxy.id}` : '/'} className="back-link"><BackIcon />{galaxy?.name ?? 'The sky'}</Link>
      <header className="place__head">
        <p className="place__eyebrow">{galaxy?.name} · Goal{goal.state !== 'active' ? ` · ${goal.state === 'resting' ? 'resting' : goal.state === 'reached' ? 'reached' : 'released'}` : ''}</p>
        <h1 className="place__title">{goal.title}</h1>
        <p className="page-horizon">{HORIZON_WORDS[goal.horizon]} · since {monthYear(goal.createdAt)}</p>
      </header>

      {editing ? <EditGoal goal={goal} onDone={() => setEditing(false)} /> : (
        goal.why
          ? <p className="page-why">“{goal.why}”</p>
          : <button type="button" className="page-why page-why--empty" onClick={() => setEditing(true)}>Why does this matter to you? Add one line.</button>
      )}

      <section className="place__section">
        <h2 className="place__h2">On your mind <button type="button" onClick={() => openCapture({ goalId: goal.id })}>Add a thought</button></h2>
        <ThoughtList thoughts={thoughts} empty="Nothing yet. Thoughts you link here circle this star." />
      </section>

      <section className="place__section">
        <h2 className="place__h2">Projects <button type="button" onClick={() => setAdding((v) => !v)}>{adding ? 'Close' : 'A new project'}</button></h2>
        {adding && <NewProject goal={goal} onDone={(p) => { setAdding(false); if (p) navigate(`/project/${p.id}`); }} />}
        {current.length === 0 && !adding && <p className="place__empty">No planets yet. A project is something you can finish, keep up, or explore, over weeks or months.</p>}
        {current.length > 0 && <ul className="rows">{current.map((p) => <ProjectRow key={p.id} p={p} />)}</ul>}
        {past.length > 0 && (
          <>
            <button type="button" className="quiet-btn done-toggle" onClick={() => setShowDone((v) => !v)}>{showDone ? 'Hide' : 'Show'} {past.length} finished or dropped</button>
            {showDone && <ul className="rows">{past.map((p) => <ProjectRow key={p.id} p={p} />)}</ul>}
          </>
        )}
      </section>

      {journal.length > 0 && (
        <section className="place__section">
          <h2 className="place__h2">In your journal <Link to="/journal">All entries</Link></h2>
          <ul className="rows">
            {journal.map((e) => (
              <li key={e.id} className="thoughtrow">
                <span />
                <div className="thoughtrow__body">
                  <p className="thought-text">{e.title}</p>
                  {e.body && <p className="thoughtrow__note">{e.body}</p>}
                  <p className="meta">{longDay(e.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="page-foot">
        {goal.state === 'active' && <button type="button" className="quiet-btn" onClick={() => void toggleFocus()}>{focused ? 'Remove from this week’s focus' : 'Focus on this this week'}</button>}
        <button type="button" className="quiet-btn" onClick={() => setEditing((v) => !v)}>Edit</button>
        {goal.state === 'active' ? (
          <>
            <button type="button" className="quiet-btn" onClick={() => void mindOps.updateGoal(goal.id, { state: 'reached' }).then(() => say('Reached. It stays in your sky, glowing quietly.'))}>Mark as reached</button>
            <button type="button" className="quiet-btn" onClick={() => void mindOps.updateGoal(goal.id, { state: 'resting' }).then(() => say('Resting. It dims, and waits.'))}>Let it rest</button>
          </>
        ) : (
          <button type="button" className="quiet-btn" onClick={() => void mindOps.updateGoal(goal.id, { state: 'active' }).then(() => say('Back in the sky.'))}>Make it active again</button>
        )}
      </footer>
    </article>
  );
}

function ProjectRow({ p }: { p: Project }) {
  const snap = useMind((s) => s.snap)!;
  const pr = progressOf(snap, p);
  const words = p.state === 'finished' ? 'Finished' : p.state === 'dropped' ? 'Dropped' : p.state === 'paused' ? 'Paused' : SHAPE_WORDS[p.shape.kind];
  return (
    <li>
      <Link to={`/project/${p.id}`} className="projlist__row">
        <PlanetGlyph progress={pr} shape={p.shape.kind} size={44} />
        <span><span className="projlist__title">{p.title}</span><span className="projlist__sub">{words}{p.summary ? ` · ${p.summary}` : ''}</span></span>
        <span className="projlist__chev" aria-hidden="true">›</span>
      </Link>
    </li>
  );
}

function NewProject({ goal, onDone }: { goal: Goal; onDone: (p: Project | null) => void }) {
  const [title, setTitle] = useState('');
  const [shape, setShape] = useState<ProjectShape | null>({ kind: 'list' });
  const save = async () => {
    if (!title.trim() || !shape) return;
    onDone(await mindOps.addProject({ galaxyId: goal.galaxyId, goalId: goal.id, title, shape: shape.kind === 'explore' && !shape.question.trim() ? { ...shape, question: title } : shape }));
  };
  return (
    <form className="newproject" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <label className="field"><span className="plaque">The project</span><input className="field__input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Learn the basic chords" autoFocus /></label>
      <ShapeFields value={shape} onChange={setShape} title={title} />
      <div className="form-actions">
        <button type="submit" className="instrument instrument--primary" disabled={!title.trim() || !shape}>Add the planet</button>
        <button type="button" className="instrument instrument--quiet" onClick={() => onDone(null)}>Cancel</button>
      </div>
    </form>
  );
}

function EditGoal({ goal, onDone }: { goal: Goal; onDone: () => void }) {
  const [title, setTitle] = useState(goal.title);
  const [why, setWhy] = useState(goal.why);
  const [horizon, setHorizon] = useState(goal.horizon);
  return (
    <form className="editgoal" onSubmit={(e) => { e.preventDefault(); if (title.trim()) void mindOps.updateGoal(goal.id, { title: title.trim(), why: why.trim(), horizon }).then(onDone); }}>
      <label className="field"><span className="plaque">The direction</span><input className="field__input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="field"><span className="plaque">Why it matters, in one line</span><input className="field__input" value={why} onChange={(e) => setWhy(e.target.value)} autoFocus={!goal.why} /></label>
      <label className="field"><span className="plaque">How far ahead</span>
        <select className="field__input field__select" value={horizon} onChange={(e) => setHorizon(e.target.value as Goal['horizon'])}>
          {(Object.keys(HORIZON_WORDS) as Goal['horizon'][]).map((h) => <option key={h} value={h}>{HORIZON_WORDS[h]}</option>)}
        </select>
      </label>
      <div className="form-actions">
        <button type="submit" className="instrument instrument--primary">Save</button>
        <button type="button" className="instrument instrument--quiet" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

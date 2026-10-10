import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { mindOps } from '@/mind/ops';
import { galaxiesOf, projectsOf, thoughtsForGoal } from '@/mind/select';
import { useMind } from '@/mind/store';
import { useSky } from '@/sky/store';
import { useUiStore } from '@/store/ui';

/** Small plates that rise over the sky: a goal before you open it, a thought, a question, a new galaxy. */
export function SkyOverlays() {
  const [params] = useSearchParams();
  const peek = useSky((s) => s.peek);
  const snap = useMind((s) => s.snap);
  if (!snap) return null;
  const goalId = params.get('goal');
  const noGoals = !snap.goals.some((g) => !g.deletedAt);
  if (peek) return <Peek />;
  if (goalId) return <GoalPeek id={goalId} />;
  if (noGoals) return <FirstStar />;
  return null;
}

function GoalPeek({ id }: { id: string }) {
  const snap = useMind((s) => s.snap)!;
  const navigate = useNavigate();
  const goal = snap.goals.find((g) => g.id === id);
  if (!goal) return null;
  const galaxy = snap.galaxies.find((g) => g.id === goal.galaxyId);
  const projects = projectsOf(snap, goal.id).filter((p) => p.state !== 'dropped').length;
  const thoughts = thoughtsForGoal(snap, goal.id).length;
  return (
    <aside className="skypeek plate" aria-live="polite">
      <p className="place__eyebrow">{galaxy?.name} · Goal</p>
      <h2 className="skypeek__title">{goal.title}</h2>
      {goal.why && <p className="skypeek__why">“{goal.why}”</p>}
      <p className="meta">{projects} {projects === 1 ? 'project' : 'projects'} · {thoughts} {thoughts === 1 ? 'thought' : 'thoughts'} on your mind</p>
      <div className="form-actions">
        <Link to={`/goal/${goal.id}`} className="instrument instrument--primary">Open</Link>
        <button type="button" className="instrument instrument--quiet" onClick={() => navigate(galaxy ? `/?galaxy=${galaxy.id}` : '/')}>Back to {galaxy?.name ?? 'the sky'}</button>
      </div>
    </aside>
  );
}

function Peek() {
  const peek = useSky((s) => s.peek)!;
  const setPeek = useSky((s) => s.setPeek);
  const snap = useMind((s) => s.snap)!;
  const say = useUiStore((s) => s.say);
  const navigate = useNavigate();
  const [text, setText] = useState('');
  if (peek.kind === 'new-galaxy') {
    return (
      <form className="skypeek plate" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void mindOps.addGalaxy(text).then((g) => { setPeek(null); say(`${g.name} is in your sky.`); navigate(`/?galaxy=${g.id}`); }); }}>
        <p className="place__eyebrow">A new galaxy</p>
        <h2 className="skypeek__title">An area of your life</h2>
        <input className="field__input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Health, a city, a side project…" aria-label="Name of the new galaxy" autoFocus />
        <div className="form-actions">
          <button type="submit" className="instrument instrument--primary" disabled={!text.trim()}>Add it to the sky</button>
          <button type="button" className="instrument instrument--quiet" onClick={() => setPeek(null)}>Not now</button>
        </div>
      </form>
    );
  }
  const t = snap.thoughts.find((x) => x.id === peek.id);
  if (!t) return null;
  const goal = t.goalId ? snap.goals.find((g) => g.id === t.goalId) : undefined;
  const open = t.isQuestion && !t.answer;
  return (
    <aside className="skypeek plate" aria-live="polite">
      <p className="place__eyebrow">{open ? 'Open question' : 'Thought'}</p>
      <h2 className={`skypeek__title ${open ? 'thought-text--q' : ''}`}>{t.text}</h2>
      {t.answer && <p className="skypeek__why">{t.answer}</p>}
      {open ? (
        <form className="thoughtrow__answerform" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void mindOps.answer(t.id, text).then(() => { setPeek(null); say('Written down. The question rests.'); }); }}>
          <textarea className="field__input field__textarea" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Even a rough answer helps." aria-label="Your answer" />
          <div className="form-actions">
            <button type="submit" className="instrument instrument--primary" disabled={!text.trim()}>Keep this answer</button>
            {goal && <Link to={`/goal/${goal.id}`} className="instrument instrument--quiet">Open {goal.title}</Link>}
            <button type="button" className="instrument instrument--quiet" onClick={() => setPeek(null)}>Close</button>
          </div>
        </form>
      ) : (
        <div className="form-actions">
          {goal && <Link to={`/goal/${goal.id}`} className="instrument">Open {goal.title}</Link>}
          <button type="button" className="instrument instrument--quiet" onClick={() => setPeek(null)}>Close</button>
        </div>
      )}
    </aside>
  );
}

/** A new museum: the first star is the first thing worth doing. */
function FirstStar() {
  const snap = useMind((s) => s.snap)!;
  const navigate = useNavigate();
  const galaxies = galaxiesOf(snap);
  const [galaxyId, setGalaxyId] = useState(galaxies[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  if (!galaxies.length) return null;
  return (
    <form className="skypeek skypeek--first plate" onSubmit={(e) => { e.preventDefault(); if (title.trim()) void mindOps.addGoal({ galaxyId, title, why }).then((g) => navigate(`/?goal=${g.id}`)); }}>
      <p className="place__eyebrow">Your first star</p>
      <h2 className="skypeek__title">A direction you could follow for years</h2>
      <input className="field__input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Figure out my next career move" aria-label="Your first goal" />
      <input className="field__input" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why it matters, in one line (optional)" aria-label="Why it matters" />
      {galaxies.length > 1 && (
        <div className="chips" role="radiogroup" aria-label="In which galaxy">
          {galaxies.map((g) => <label key={g.id} className="chip"><input type="radio" name="first-galaxy" checked={galaxyId === g.id} onChange={() => setGalaxyId(g.id)} /><span>{g.name}</span></label>)}
        </div>
      )}
      <div className="form-actions"><button type="submit" className="instrument instrument--primary" disabled={!title.trim()}>Set it in the sky</button></div>
      <p className="meta">Or start by emptying your head: the gold button captures anything, and it waits in Unsorted.</p>
    </form>
  );
}

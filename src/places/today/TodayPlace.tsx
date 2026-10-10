import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { dayKey, startOfWeek } from '@/mind/calendar';
import { mindOps } from '@/mind/ops';
import { describeRepeat } from '@/mind/recurrence';
import { brightness, galaxiesOf, goalsIn } from '@/mind/select';
import { useMind } from '@/mind/store';
import { planToday, type FocusItem } from '@/mind/today';
import { timeOfDayGreeting } from '@/lib/dates';
import { StarGlyph, ThoughtGlyph } from '@/shell/Glyphs';
import { useFocus } from '@/shell/focus';
import { useUiStore } from '@/store/ui';
import { longDay } from '../shared/words';
import '../shared/pages.css';
import './today.css';

/** Open the app, see one thought and one thing to do. Nothing more is asked of you. */
export default function TodayPlace() {
  const snap = useMind((s) => s.snap);
  const clearFocus = useFocus((s) => s.clearFocus);
  const [now] = useState(() => Date.now());
  const [choosing, setChoosing] = useState(false);
  useEffect(() => clearFocus(), [clearFocus]);
  const plan = useMemo(() => (snap ? planToday(snap, now) : null), [snap, now]);
  if (!snap || !plan) return null;
  const name = snap.mind.visitorName;

  return (
    <div className="place plate today2">
      <header className="place__head">
        <p className="place__eyebrow">{longDay(now)}</p>
        <h1 className="place__title">{timeOfDayGreeting(new Date(now))}{name ? `, ${name}` : ''}</h1>
      </header>

      {plan.reviewWeek && (
        <Link to="/review" className="today2__review">
          <span className="place__eyebrow">Your week is ready</span>
          <span className="today2__review-text">Two quiet minutes: what moved, what went quiet, and what to focus on next.</span>
        </Link>
      )}

      {plan.thought && <ThoughtCard t={plan.thought.t} reason={plan.thought.reason} />}

      <section className="place__section">
        <h2 className="place__h2">
          {plan.focusSource === 'chosen' ? 'This week’s focus' : plan.focusSource === 'last-week' ? 'Still your focus' : 'Where you might put your attention'}
          <button type="button" onClick={() => setChoosing((v) => !v)}>{choosing ? 'Done' : 'Choose'}</button>
        </h2>
        {choosing && <ChooseFocus current={plan.focus.map((f) => f.goal.id)} />}
        {plan.focus.length === 0 && !choosing && (
          <p className="place__empty">No goals yet. <Link to="/">Set your first star in the sky</Link>, a direction you could follow for years.</p>
        )}
        <div className="today2__focus">{plan.focus.map((f) => <FocusCard key={f.goal.id} item={f} />)}</div>
      </section>

      <p className="today2__quiet">
        {plan.unsortedCount > 0
          ? <><Link to="/unsorted">{plan.unsortedCount} {plan.unsortedCount === 1 ? 'thought is' : 'thoughts are'} waiting in Unsorted</Link>{plan.unsortedCount > 10 ? '. Five minutes of sorting might feel good.' : '.'}</>
          : 'Nothing is waiting in Unsorted.'}
        {' '}<Link to="/journal">Write a line about today</Link>.
      </p>
    </div>
  );
}

function ThoughtCard({ t, reason }: { t: import('@/mind/types').Thought; reason: 'question' | 'forgotten' }) {
  const say = useUiStore((s) => s.say);
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState('');
  const [gone, setGone] = useState(false);
  const snap = useMind((s) => s.snap)!;
  if (gone) return null;
  const where = t.goalId ? snap.goals.find((g) => g.id === t.goalId)?.title : t.projectId ? snap.projects.find((p) => p.id === t.projectId)?.title : snap.galaxies.find((g) => g.id === t.galaxyId)?.name;
  const rest = (days: number) => { void mindOps.updateThought(t.id, { restUntil: Date.now() + days * 86_400_000 }); setGone(true); };
  return (
    <section className="today2__thought">
      <p className="place__eyebrow">{reason === 'question' ? 'Still on your mind' : 'You may have forgotten'}</p>
      <p className={`today2__thought-text ${t.isQuestion ? 'thought-text--q' : ''}`}><ThoughtGlyph question={t.isQuestion} /> {t.text}</p>
      {where && <p className="meta">{where}</p>}
      {answering ? (
        <form className="thoughtrow__answerform" onSubmit={(e) => { e.preventDefault(); if (answer.trim()) void mindOps.answer(t.id, answer).then(() => { setGone(true); say('Written down. The question rests.'); }); }}>
          <textarea className="field__input field__textarea" rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Even a rough answer helps." aria-label="Your answer" autoFocus />
          <div className="form-actions">
            <button type="submit" className="instrument instrument--primary" disabled={!answer.trim()}>Keep this answer</button>
            <button type="button" className="instrument instrument--quiet" onClick={() => setAnswering(false)}>Not yet</button>
          </div>
        </form>
      ) : (
        <div className="form-actions">
          {t.isQuestion && <button type="button" className="instrument" onClick={() => setAnswering(true)}>Write an answer</button>}
          {!t.isQuestion && <button type="button" className="instrument" onClick={() => { void mindOps.visit('thoughts', t.id); setGone(true); say('Good. It stays.'); }}>Still matters</button>}
          <button type="button" className="instrument instrument--quiet" onClick={() => rest(7)}>Not this week</button>
          <button type="button" className="instrument instrument--quiet" onClick={() => { void mindOps.letGo(t.id); setGone(true); say('Let go.'); }}>Let it go</button>
        </div>
      )}
    </section>
  );
}

function FocusCard({ item }: { item: FocusItem }) {
  const snap = useMind((s) => s.snap)!;
  const say = useUiStore((s) => s.say);
  const { goal, step, project, doneToday } = item;
  const tick = async () => {
    if (!step) return;
    await mindOps.completeStep(step.id, step.amount ? { amount: step.amount.per } : {});
    say('Done. That is enough for today, unless you want more.');
  };
  const repeating = step && (step.kind === 'repeat' || step.kind === 'session');
  return (
    <article className="focuscard">
      <Link to={`/goal/${goal.id}`} className="focuscard__goal">
        <StarGlyph brightness={brightness(snap, goal.id)} size={28} />
        <span>
          <span className="focuscard__title">{goal.title}</span>
          {goal.why && <span className="focuscard__why">“{goal.why}”</span>}
        </span>
      </Link>
      {step ? (
        <div className="focuscard__step">
          <button type="button" className="step__check" onClick={() => void tick()} aria-label={`Done: ${step.text}`} />
          <span>
            <span className="step__text">{step.text}</span>
            <span className="meta">{project && <Link to={`/project/${project.id}`}>{project.title}</Link>}{repeating ? ` · ${describeRepeat(step)}` : ''}</span>
          </span>
        </div>
      ) : (
        <p className="focuscard__none">{doneToday.length ? `Done today: ${doneToday.map((s) => s.text).join(', ')}. That is enough.` : 'Nothing is waiting. You could add a step, or simply think about it today.'}</p>
      )}
      {step && doneToday.length > 0 && <p className="meta">Done today: {doneToday.map((s) => s.text).join(', ')}</p>}
    </article>
  );
}

function ChooseFocus({ current }: { current: string[] }) {
  const snap = useMind((s) => s.snap)!;
  const say = useUiStore((s) => s.say);
  const week = dayKey(startOfWeek(Date.now()));
  const toggle = async (id: string) => {
    const on = current.includes(id);
    const next = on ? current.filter((x) => x !== id) : [...current, id].slice(-2);
    await mindOps.saveReview({ weekStart: week, focusGoalIds: next });
    if (!on && current.length >= 2) say('Two at most. The earlier one stepped aside.');
  };
  return (
    <div className="today2__choose">
      <p className="meta">Choose one or two goals for this week. Today shows only these.</p>
      {galaxiesOf(snap).map((g) => {
        const goals = goalsIn(snap, g.id).filter((x) => x.state === 'active');
        if (!goals.length) return null;
        return (
          <div key={g.id} className="chips" role="group" aria-label={g.name}>
            {goals.map((x) => <button key={x.id} type="button" className="chip" aria-pressed={current.includes(x.id)} onClick={() => void toggle(x.id)}>{x.title}</button>)}
          </div>
        );
      })}
    </div>
  );
}

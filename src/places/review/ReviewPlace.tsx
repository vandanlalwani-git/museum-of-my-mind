import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ERROR_TEXT, estimateBytes, reflect, type ReflectOutcome } from '@/ai/client';
import { clearSessionKey, hasSessionKey, looksLikeAnthropicKey, onSessionKeyChange, setSessionKey } from '@/ai/session';
import { addDays, dayKey, parseDayKey, startOfWeek } from '@/mind/calendar';
import { mindOps } from '@/mind/ops';
import { galaxiesOf, goalsIn } from '@/mind/select';
import { useMind } from '@/mind/store';
import { focusGoalIds, reviewWeekFor } from '@/mind/today';
import type { MindSnapshot } from '@/mind/types';
import { weekSummary, type WeekSummary } from '@/mind/week';
import { newId } from '@/lib/ids';
import { useFocus } from '@/shell/focus';
import { useSettingsStore } from '@/store/settings';
import { useUiStore } from '@/store/ui';
import { DEFAULT_MODEL, LIMITS, MODELS, type ReflectItem, type ReflectMode, type ReflectRequest } from '../../../shared/reflect-schema';
import { shortDay } from '../shared/words';
import '../shared/pages.css';
import './review.css';

/** Sunday's two-minute check-in, made on the device from the keeper's own records. */
export default function ReviewPlace() {
  const snap = useMind((s) => s.snap);
  const [params] = useSearchParams();
  const clearFocus = useFocus((s) => s.clearFocus);
  useEffect(() => clearFocus(), [clearFocus]);
  const now = Date.now();
  const week = params.get('week') ?? (snap ? reviewWeekFor(snap, now) : null) ?? dayKey(startOfWeek(now));
  const summary = useMemo(() => (snap ? weekSummary(snap, week) : null), [snap, week]);
  if (!snap || !summary) return null;
  return <Review snap={snap} w={summary} />;
}

function Review({ snap, w }: { snap: MindSnapshot; w: WeekSummary }) {
  const navigate = useNavigate();
  const say = useUiStore((s) => s.say);
  const aiEnabled = useSettingsStore((s) => s.aiEnabled);
  // Focus chosen here applies to the week after the one being reviewed.
  const next = dayKey(addDays(parseDayKey(w.weekStart)!, 7));
  const existing = snap.reviews.find((r) => r.weekStart === w.weekStart && !r.deletedAt);
  const [focus, setFocus] = useState<string[]>(() => {
    const planned = snap.reviews.find((r) => r.weekStart === next && !r.deletedAt)?.focusGoalIds;
    return planned?.length ? planned : focusGoalIds(snap, w.start.getTime()).ids;
  });
  const [line, setLine] = useState(existing?.line ?? '');
  const range = `${shortDay(w.start)} to ${shortDay(addDays(w.end, -1))}`;
  const toggle = (id: string) => setFocus((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id].slice(-2)));

  const close = async () => {
    await mindOps.saveReview({ weekStart: w.weekStart, focusGoalIds: existing?.focusGoalIds ?? focus, line, close: true });
    await mindOps.saveReview({ weekStart: next, focusGoalIds: focus });
    if (line.trim()) await mindOps.addJournal({ title: line, body: `The week of ${range}.` });
    say('The week is closed. Today will show what you chose.');
    navigate('/today');
  };

  return (
    <div className="place plate review">
      <header className="place__head">
        <p className="place__eyebrow">Your week · about two minutes</p>
        <h1 className="place__title">{range}</h1>
        {existing?.closedAt && <p className="meta">You closed this week already. You can change it.</p>}
      </header>

      <section className="place__section">
        <h2 className="place__h2">What moved</h2>
        {w.moved.length === 0 ? <p className="place__empty">Nothing was ticked this week. That is allowed. Some weeks are for resting or thinking.</p> : (
          <ul className="rows">
            {w.moved.map((m) => (
              <li key={m.project.id} className="moved">
                <Link to={`/project/${m.project.id}`} className="moved__title">{m.project.title}</Link>
                <span className="meta">
                  {m.goal && <span>{m.goal.title}</span>}
                  <span>· {m.count ? `${m.count.from} → ${m.count.to} of ${m.count.target}` : m.finished.length && m.finished.length === m.ticks ? m.finished.join(', ') : `${m.ticks} ${m.ticks === 1 ? 'time' : 'times'}`}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="meta">{w.captured} {w.captured === 1 ? 'thought' : 'thoughts'} captured · {w.journal.length} journal {w.journal.length === 1 ? 'entry' : 'entries'}</p>
      </section>

      {(w.quiet.length > 0 || w.unsorted > 0 || w.openQuestions > 0) && (
        <section className="place__section">
          <h2 className="place__h2">What went quiet</h2>
          <ul className="rows">
            {w.quiet.map((g) => (
              <li key={g.id} className="moved">
                <span className="moved__title">{g.title}</span>
                <span className="meta"><Link to={`/goal/${g.id}`}>Pick one small step</Link> · or let it rest; that is a choice too</span>
              </li>
            ))}
            {w.unsorted > 0 && <li className="moved"><span className="moved__title">{w.unsorted} {w.unsorted === 1 ? 'thought' : 'thoughts'} in Unsorted</span><span className="meta"><Link to="/unsorted">Sort a few now</Link></span></li>}
            {w.openQuestions > 0 && <li className="moved"><span className="moved__title">{w.openQuestions} open {w.openQuestions === 1 ? 'question' : 'questions'}</span><span className="meta"><Link to="/search">See them</Link> · a rough answer often clears the fog</span></li>}
          </ul>
        </section>
      )}

      <section className="place__section">
        <h2 className="place__h2">Next week’s focus</h2>
        <p className="meta">One or two goals. Today will show only these.</p>
        {galaxiesOf(snap).map((g) => {
          const goals = goalsIn(snap, g.id).filter((x) => x.state === 'active');
          if (!goals.length) return null;
          return <div key={g.id} className="chips" role="group" aria-label={g.name}>{goals.map((x) => <button key={x.id} type="button" className="chip" aria-pressed={focus.includes(x.id)} onClick={() => toggle(x.id)}>{x.title}</button>)}</div>;
        })}
      </section>

      <section className="place__section">
        <h2 className="place__h2">One line about the week (optional)</h2>
        <input className="field__input" value={line} onChange={(e) => setLine(e.target.value)} placeholder="Slow week, but the app moved." aria-label="One line about the week" />
        <p className="meta">It goes into your journal.</p>
      </section>

      <div className="form-actions">
        <button type="button" className="instrument instrument--primary" onClick={() => void close()}>Close the week</button>
        <Link to="/today" className="instrument instrument--quiet">Not now</Link>
      </div>

      {aiEnabled && <ReflectOnWeek snap={snap} w={w} />}
    </div>
  );
}

const WEEK_MODES: { id: ReflectMode; label: string }[] = [
  { id: 'themes', label: 'What kept coming up' },
  { id: 'tensions', label: 'Tensions, said kindly' },
  { id: 'next-action', label: 'One small next step' },
];

/** Optional and off by default: ask your own Claude to reflect on this week, with your own key. */
function ReflectOnWeek({ snap, w }: { snap: MindSnapshot; w: WeekSummary }) {
  const say = useUiStore((s) => s.say);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ReflectMode>('themes');
  const [keyInput, setKeyInput] = useState('');
  const [keyHeld, setKeyHeld] = useState(hasSessionKey());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Extract<ReflectOutcome, { ok: true }> | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => onSessionKeyChange(() => setKeyHeld(hasSessionKey())), []);

  const items = useMemo<ReflectItem[]>(() => {
    const a = w.start.getTime(), b = w.end.getTime();
    const out: ReflectItem[] = [];
    const seen = new Set<string>();
    const add = (i: ReflectItem) => { if (!seen.has(i.id) && out.length < LIMITS.MAX_ITEMS) { seen.add(i.id); out.push({ ...i, title: i.title.slice(0, LIMITS.MAX_TITLE_CHARS), body: i.body.slice(0, LIMITS.MAX_ITEM_CHARS) }); } };
    for (const m of w.moved) {
      if (m.goal) add({ id: m.goal.id, kind: 'goal', title: m.goal.title, body: m.goal.why, tags: m.goal.tags });
      add({ id: m.project.id, kind: 'project', title: m.project.title, body: `${m.project.summary} Moved ${m.ticks} times this week.`.trim(), tags: m.project.tags });
    }
    for (const g of w.quiet) add({ id: g.id, kind: 'goal', title: g.title, body: `${g.why} (quiet lately)`.trim(), tags: g.tags });
    for (const t of snap.thoughts.filter((x) => !x.deletedAt && x.createdAt >= a && x.createdAt < b)) add({ id: t.id, kind: t.origin === 'link' ? 'link' : t.origin === 'idea' ? 'idea' : 'note', title: t.text, body: [t.body, t.url].filter(Boolean).join('\n'), tags: t.tags });
    for (const e of w.journal) add({ id: e.id, kind: 'memory', title: e.title, body: e.body, tags: e.tags });
    return out;
  }, [snap, w]);
  const request: ReflectRequest = { mode, model: DEFAULT_MODEL, items };
  const bytes = estimateBytes(request);

  const send = async () => {
    setError(null);
    if (!keyHeld) {
      if (!looksLikeAnthropicKey(keyInput)) { setError('That does not look like an Anthropic key (they start with sk-ant-). Nothing was sent.'); return; }
      setSessionKey(keyInput); setKeyInput('');
    }
    setBusy(true);
    abort.current = new AbortController();
    const out = await reflect(request, abort.current.signal);
    abort.current = null; setBusy(false);
    if (!out.ok) { if (out.error === 'invalid_key') clearSessionKey(); setError(ERROR_TEXT[out.error]); return; }
    setOutcome(out);
  };

  const keep = async () => {
    if (!outcome) return;
    const mind = useMind.getState().mind!;
    const now = Date.now();
    await useMind.getState().put('reflections', {
      id: newId(), museumId: mind.id, createdAt: now, updatedAt: now, lastVisitedAt: now, tags: [],
      mode, model: outcome.model, itemIds: items.map((i) => i.id), themes: outcome.result.themes, reflection: outcome.result.reflection, reasoning: outcome.result.reasoning,
      accepted: { tags: 0, threads: 0, projects: 0, actions: 0 },
    });
    say('The reflection is kept in this museum.');
    setOutcome(null); setOpen(false);
  };

  if (!open) return <button type="button" className="quiet-btn review__ai" onClick={() => setOpen(true)}>Ask my AI to reflect on this week (optional)</button>;
  return (
    <section className="place__section reflectbox">
      <h2 className="place__h2">Ask my AI · optional</h2>
      {outcome ? (
        <>
          {outcome.result.themes.length > 0 && <div className="chips">{outcome.result.themes.map((t) => <span key={t} className="chip"><span>{t}</span></span>)}</div>}
          <p className="reflectbox__text">{outcome.result.reflection}</p>
          {outcome.result.actions.length > 0 && <ul className="rows">{outcome.result.actions.map((a, i) => <li key={i} className="moved"><span className="moved__title">{a.text}</span><span className="meta">{a.why}</span></li>)}</ul>}
          <div className="form-actions">
            <button type="button" className="instrument instrument--primary" onClick={() => void keep()}>Keep the reflection</button>
            <button type="button" className="instrument instrument--quiet" onClick={() => setOutcome(null)}>Discard</button>
          </div>
          <p className="meta">Nothing in your museum changes unless you add it yourself.</p>
        </>
      ) : (
        <>
          <div className="chips" role="radiogroup" aria-label="What to ask">
            {WEEK_MODES.map((m) => <label key={m.id} className="chip"><input type="radio" name="week-mode" checked={mode === m.id} onChange={() => setMode(m.id)} /><span>{m.label}</span></label>)}
          </div>
          <p className="review__p">Exactly these {items.length} items from this week would be sent, once, through this site's relay to Anthropic, using your key and credits ({(bytes / 1024).toFixed(1)} KB, model {MODELS.find((m) => m.id === DEFAULT_MODEL)?.label}).</p>
          <ul className="reflectbox__items">{items.map((i) => <li key={i.id}><span className="meta">{i.kind}</span> {i.title}</li>)}</ul>
          {!keyHeld && <input className="field__input" type="password" autoComplete="off" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="Your Anthropic key, kept only in this tab's memory" aria-label="Anthropic key" />}
          {error && <p className="capture__error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="instrument instrument--primary" disabled={busy || !items.length || (!keyHeld && !keyInput)} onClick={() => void send()}>{busy ? 'Asking…' : 'Send this week'}</button>
            {busy && <button type="button" className="instrument instrument--quiet" onClick={() => abort.current?.abort()}>Cancel</button>}
            <button type="button" className="instrument instrument--quiet" onClick={() => setOpen(false)}>Close</button>
          </div>
        </>
      )}
    </section>
  );
}

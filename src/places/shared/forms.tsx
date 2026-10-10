/**
 * Small forms shared by goal and project pages: choosing a project's shape,
 * and writing a step with its kind and rhythm.
 */
import { useState } from 'react';
import { addDays, dayKey, startOfDay } from '@/mind/calendar';
import { SHAPE_WORDS } from '@/mind/shapes';
import type { ProjectShape, ProjectShapeKind, RepeatRule, StepKind } from '@/mind/types';

const SHAPE_HELP: Record<ProjectShapeKind, string> = {
  list: 'Done when every step is ticked.',
  number: 'Done at a target. Repeating steps count towards it.',
  habit: 'Never done. Kept, or not, week by week.',
  date: 'Steps that lead up to a day.',
  levels: 'Each level opens the next.',
  explore: 'Gather thoughts until you know what you think.',
};
export const SHAPE_ORDER: ProjectShapeKind[] = ['list', 'number', 'habit', 'date', 'levels', 'explore'];

/** Picks a shape and asks only for what that shape needs. Returns null until it is complete. */
export function ShapeFields({ value, onChange, title }: { value: ProjectShape | null; onChange: (s: ProjectShape | null) => void; title: string }) {
  const [kind, setKind] = useState<ProjectShapeKind>(value?.kind ?? 'list');
  const [target, setTarget] = useState(value?.kind === 'number' ? String(value.target) : '');
  const [unit, setUnit] = useState(value?.kind === 'number' ? value.unit : '');
  const [start, setStart] = useState(value?.kind === 'number' && value.start ? String(value.start) : '');
  const [perWeek, setPerWeek] = useState(value?.kind === 'habit' ? String(value.perWeek) : '3');
  const [date, setDate] = useState(value?.kind === 'date' ? value.date : dayKey(addDays(startOfDay(Date.now()), 30)));
  const [levels, setLevels] = useState(value?.kind === 'levels' ? value.levels.join('\n') : '');
  const [question, setQuestion] = useState(value?.kind === 'explore' ? value.question : '');

  const build = (k: ProjectShapeKind, f: Record<string, string>): ProjectShape | null => {
    switch (k) {
      case 'list': return { kind: 'list' };
      case 'number': { const t = Math.round(Number(f.target)); if (!(t > 0)) return null; const s = Math.max(0, Math.round(Number(f.start) || 0)); return { kind: 'number', target: t, unit: f.unit!.trim() || 'times', ...(s ? { start: s } : {}) }; }
      case 'habit': { const n = Math.round(Number(f.perWeek)); return n >= 1 && n <= 14 ? { kind: 'habit', perWeek: n } : null; }
      case 'date': return /^\d{4}-\d{2}-\d{2}$/.test(f.date!) ? { kind: 'date', date: f.date! } : null;
      case 'levels': { const ls = f.levels!.split('\n').map((l) => l.trim()).filter(Boolean); return ls.length >= 2 ? { kind: 'levels', levels: ls, reached: value?.kind === 'levels' ? Math.min(value.reached, ls.length) : 0 } : null; }
      case 'explore': return { kind: 'explore', question: f.question!.trim() || title.trim() || 'What do I think?', ...(value?.kind === 'explore' && value.conclusion ? { conclusion: value.conclusion } : {}) };
    }
  };
  const fields = { target, unit, start, perWeek, date, levels, question };
  const update = (k: ProjectShapeKind, patch: Partial<typeof fields>) => onChange(build(k, { ...fields, ...patch }));

  return (
    <div className="shapefields">
      <div className="shapefields__kinds" role="radiogroup" aria-label="What kind of project is it?">
        {SHAPE_ORDER.map((k) => (
          <label key={k} className={`shapeopt ${kind === k ? 'shapeopt--on' : ''}`}>
            <input type="radio" name="shape" checked={kind === k} onChange={() => { setKind(k); update(k, {}); }} />
            <span className="shapeopt__name">{SHAPE_WORDS[k]}</span>
            <span className="shapeopt__help">{SHAPE_HELP[k]}</span>
          </label>
        ))}
      </div>
      {kind === 'number' && (
        <div className="shapefields__row">
          <label className="field"><span className="plaque">Target</span><input className="field__input" inputMode="numeric" value={target} onChange={(e) => { setTarget(e.target.value); update('number', { target: e.target.value }); }} placeholder="50" /></label>
          <label className="field"><span className="plaque">Of what</span><input className="field__input" value={unit} onChange={(e) => { setUnit(e.target.value); update('number', { unit: e.target.value }); }} placeholder="songs" /></label>
          <label className="field"><span className="plaque">Already done</span><input className="field__input" inputMode="numeric" value={start} onChange={(e) => { setStart(e.target.value); update('number', { start: e.target.value }); }} placeholder="0" /></label>
        </div>
      )}
      {kind === 'habit' && (
        <label className="field"><span className="plaque">Times a week</span><input className="field__input" inputMode="numeric" value={perWeek} onChange={(e) => { setPerWeek(e.target.value); update('habit', { perWeek: e.target.value }); }} /></label>
      )}
      {kind === 'date' && (
        <label className="field"><span className="plaque">The day</span><input className="field__input" type="date" value={date} onChange={(e) => { setDate(e.target.value); update('date', { date: e.target.value }); }} /></label>
      )}
      {kind === 'levels' && (
        <label className="field"><span className="plaque">Levels, one per line, easiest first</span><textarea className="field__input field__textarea" rows={3} value={levels} onChange={(e) => { setLevels(e.target.value); update('levels', { levels: e.target.value }); }} placeholder={'Run 1K without stopping\nRun 3K\nRun 5K'} /></label>
      )}
      {kind === 'explore' && (
        <label className="field"><span className="plaque">The question</span><input className="field__input" value={question} onChange={(e) => { setQuestion(e.target.value); update('explore', { question: e.target.value }); }} placeholder="Would a four-day week suit me?" /></label>
      )}
    </div>
  );
}

export const STEP_KIND_WORDS: Record<StepKind, string> = {
  once: 'One-off', repeat: 'Repeating', session: 'A session', waiting: 'Waiting on someone', someday: 'Someday', milestone: 'A milestone',
};
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NUM = [1, 2, 3, 4, 5, 6, 0];

export interface StepDraft { text: string; kind: StepKind; repeat?: RepeatRule; waitingOn?: string; amount?: { per: number; unit: string } }

/** Writes a step: what it is, what kind, and how often if it repeats. */
export function StepForm({ onSave, onCancel, initial, suggestRepeat }: { onSave: (d: StepDraft) => void; onCancel?: () => void; initial?: Partial<StepDraft>; suggestRepeat?: boolean }) {
  const [text, setText] = useState(initial?.text ?? '');
  const [kind, setKind] = useState<StepKind>(initial?.kind ?? (suggestRepeat ? 'repeat' : 'once'));
  const [every, setEvery] = useState<RepeatRule['every']>(initial?.repeat?.every ?? 'week');
  const [days, setDays] = useState<number[]>(initial?.repeat?.every === 'weekdays' ? initial.repeat.days : [2, 6]);
  const [day, setDay] = useState<number>(initial?.repeat?.every === 'week' ? initial.repeat.day : 0);
  const [n, setN] = useState(initial?.repeat?.every === 'n-days' ? String(initial.repeat.n) : initial?.repeat?.every === 'times-per-week' ? String(initial.repeat.times) : '3');
  const [waiting, setWaiting] = useState(initial?.waitingOn ?? '');
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount.per) : '');
  const [unit, setUnit] = useState(initial?.amount?.unit ?? 'minutes');

  const rule = (): RepeatRule => {
    const num = Math.max(1, Math.round(Number(n) || 1));
    switch (every) {
      case 'day': return { every: 'day' };
      case 'weekdays': return { every: 'weekdays', days: days.length ? days : [day] };
      case 'week': return { every: 'week', day };
      case 'n-days': return { every: 'n-days', n: Math.max(2, num) };
      case 'times-per-week': return { every: 'times-per-week', times: Math.min(14, num) };
    }
  };
  const save = () => {
    if (!text.trim()) return;
    const per = Math.round(Number(amount));
    onSave({
      text, kind,
      ...(kind === 'repeat' || kind === 'session' ? { repeat: rule() } : {}),
      ...(kind === 'waiting' && waiting.trim() ? { waitingOn: waiting.trim() } : {}),
      ...(kind === 'session' && per > 0 ? { amount: { per, unit: unit.trim() || 'minutes' } } : {}),
    });
    if (!initial) setText('');
  };

  return (
    <form className="stepform" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <input className="stepform__text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Something you can do in one sitting" aria-label="The step" autoFocus={!!initial} />
      <div className="chips" role="radiogroup" aria-label="Kind of step">
        {(Object.keys(STEP_KIND_WORDS) as StepKind[]).map((k) => (
          <label key={k} className="chip"><input type="radio" name={`step-kind-${initial?.text ?? 'new'}`} checked={kind === k} onChange={() => setKind(k)} /><span>{STEP_KIND_WORDS[k]}</span></label>
        ))}
      </div>
      {(kind === 'repeat' || kind === 'session') && (
        <div className="stepform__rule">
          <select value={every} onChange={(e) => setEvery(e.target.value as RepeatRule['every'])} aria-label="How often">
            <option value="day">Every day</option>
            <option value="week">Once a week, on</option>
            <option value="weekdays">On chosen days</option>
            <option value="times-per-week">A number of times a week</option>
            <option value="n-days">Every few days</option>
          </select>
          {every === 'week' && (
            <select value={day} onChange={(e) => setDay(Number(e.target.value))} aria-label="Which day">
              {DAYS.map((d, i) => <option key={d} value={DAY_NUM[i]}>{d}</option>)}
            </select>
          )}
          {every === 'weekdays' && (
            <div className="chips">
              {DAYS.map((d, i) => {
                const v = DAY_NUM[i]!;
                const on = days.includes(v);
                return <button key={d} type="button" className="chip" aria-pressed={on} onClick={() => setDays(on ? days.filter((x) => x !== v) : [...days, v])}>{d}</button>;
              })}
            </div>
          )}
          {(every === 'times-per-week' || every === 'n-days') && (
            <label className="stepform__n"><input inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} aria-label={every === 'n-days' ? 'Every how many days' : 'Times a week'} />{every === 'n-days' ? 'days' : 'times a week'}</label>
          )}
        </div>
      )}
      {kind === 'session' && (
        <div className="stepform__rule">
          <label className="stepform__n"><input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="20" aria-label="How much each time" /></label>
          <input className="stepform__unit" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit" />
        </div>
      )}
      {kind === 'waiting' && <input className="stepform__text" value={waiting} onChange={(e) => setWaiting(e.target.value)} placeholder="Who or what is it waiting on?" aria-label="Waiting on" />}
      <div className="form-actions">
        <button type="submit" className="instrument instrument--primary" disabled={!text.trim()}>{initial ? 'Save' : 'Add step'}</button>
        {onCancel && <button type="button" className="instrument instrument--quiet" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

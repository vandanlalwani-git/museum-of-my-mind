import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { mindOps } from '@/mind/ops';
import { useMind } from '@/mind/store';
import type { JournalEntry } from '@/mind/types';
import { onThisDay } from '@/mind/week';
import { useFocus } from '@/shell/focus';
import { useUiStore } from '@/store/ui';
import { longDay, monthOnly } from '../shared/words';
import '../shared/pages.css';
import './journal.css';

/** What happened, and how it felt. Kept apart from goals, so writing here never feels like a task. */
export default function JournalPlace() {
  const snap = useMind((s) => s.snap);
  const clearFocus = useFocus((s) => s.clearFocus);
  const { hash } = useLocation();
  useEffect(() => clearFocus(), [clearFocus]);
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    el?.scrollIntoView({ block: 'center' });
    el?.classList.add('jentry--found');
  }, [hash]);
  const entries = useMemo(() => (snap ? snap.journal.filter((e) => !e.deletedAt).sort((a, b) => b.at - a.at) : []), [snap]);
  const months = useMemo(() => {
    const m = new Map<string, JournalEntry[]>();
    for (const e of entries) { const k = monthOnly(e.at); m.set(k, [...(m.get(k) ?? []), e]); }
    return [...m.entries()];
  }, [entries]);
  if (!snap) return null;
  const echoes = onThisDay(snap);

  return (
    <div className="place plate journal">
      <header className="place__head">
        <p className="place__eyebrow">Journal</p>
        <h1 className="place__title">What happened, and how it felt</h1>
      </header>
      <Write />
      {echoes.length > 0 && (
        <section className="echo">
          <p className="place__eyebrow">On this day · {echoes[0]!.ago.toLowerCase()}</p>
          {echoes.map(({ entry }) => <p key={entry.id} className="echo__text">“{entry.title}{entry.body ? ` ${entry.body}` : ''}”</p>)}
        </section>
      )}
      {entries.length === 0 && <p className="place__empty">Nothing written yet. A line a day is plenty; a line a week is fine too.</p>}
      {months.map(([month, list]) => (
        <section key={month} className="place__section">
          <h2 className="place__h2">{month}</h2>
          <ul className="rows">{list.map((e) => <Entry key={e.id} e={e} />)}</ul>
        </section>
      ))}
    </div>
  );
}

function Write() {
  const say = useUiStore((s) => s.say);
  const [text, setText] = useState('');
  const save = async () => {
    const [first = '', ...rest] = text.trim().split('\n');
    if (!first.trim()) return;
    await mindOps.addJournal({ title: first, body: rest.join('\n') });
    setText('');
    say('Kept in your journal.');
  };
  return (
    <form className="jwrite" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <textarea id="journal-text" className="jwrite__text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="How was today?" aria-label="Write in your journal"
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save(); } }} />
      <div className="form-actions"><button type="submit" className="instrument instrument--primary" disabled={!text.trim()}>Keep it</button></div>
    </form>
  );
}

function Entry({ e }: { e: JournalEntry }) {
  const snap = useMind((s) => s.snap)!;
  const say = useUiStore((s) => s.say);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(e.title);
  const [body, setBody] = useState(e.body);
  const goal = e.goalId ? snap.goals.find((g) => g.id === e.goalId) : undefined;
  const project = e.projectId ? snap.projects.find((p) => p.id === e.projectId) : undefined;
  if (editing) {
    return (
      <li id={e.id} className="jentry">
        <form className="thoughtrow__answerform" onSubmit={(ev) => { ev.preventDefault(); void mindOps.updateJournal(e.id, { title: title.trim() || e.title, body: body.trim() }).then(() => setEditing(false)); }}>
          <input className="field__input" value={title} onChange={(ev) => setTitle(ev.target.value)} aria-label="Entry" />
          <textarea className="field__input field__textarea" rows={3} value={body} onChange={(ev) => setBody(ev.target.value)} aria-label="More" />
          <div className="form-actions">
            <button type="submit" className="instrument instrument--primary">Save</button>
            <button type="button" className="instrument instrument--quiet" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      </li>
    );
  }
  return (
    <li id={e.id} className="jentry">
      <p className="jentry__date">{longDay(e.at)}</p>
      <p className="jentry__title">{e.title}</p>
      {e.body && <p className="jentry__body">{e.body}</p>}
      <p className="meta">
        {goal && <Link to={`/goal/${goal.id}`}>{goal.title}</Link>}
        {project && <Link to={`/project/${project.id}`}>{project.title}</Link>}
        <button type="button" className="quiet-btn" onClick={() => setEditing(true)}>Edit</button>
        <button type="button" className="quiet-btn" onClick={() => void mindOps.removeJournal(e.id).then(() => say('Removed from your journal.'))}>Remove</button>
      </p>
    </li>
  );
}

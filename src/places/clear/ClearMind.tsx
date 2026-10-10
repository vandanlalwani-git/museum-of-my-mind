import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { mindOps } from '@/mind/ops';
import { galaxiesOf } from '@/mind/select';
import { useMind } from '@/mind/store';
import './clear.css';

const DRAFT_KEY = 'museum:clear-draft';
const readDraft = (): string => { try { return localStorage.getItem(DRAFT_KEY) ?? ''; } catch { return ''; } };
const writeDraft = (v: string) => { try { if (v) localStorage.setItem(DRAFT_KEY, v); else localStorage.removeItem(DRAFT_KEY); } catch { /* storage may be off */ } };

/** Pour everything out, one thought per line. No decisions. It all waits in Unsorted. */
export default function ClearMind() {
  const snap = useMind((s) => s.snap);
  const [text, setText] = useState(readDraft);
  const [galaxyId, setGalaxyId] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => writeDraft(text), [text]);
  if (!snap) return null;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const save = async () => {
    const n = await mindOps.addThoughts(lines, galaxyId);
    setText(''); writeDraft(''); setSaved(n);
  };

  if (saved !== null) {
    return (
      <div className="place plate clear clear--done">
        <p className="place__eyebrow">Clear my mind</p>
        <h1 className="place__title">{saved} {saved === 1 ? 'thought is' : 'thoughts are'} out of your head</h1>
        <p className="place__lede">They are waiting in Unsorted. Sort them when you feel calmer. Today, tomorrow, or on Sunday.</p>
        <div className="form-actions">
          <Link to="/unsorted" className="instrument instrument--primary">Sort them now</Link>
          <button type="button" className="instrument" onClick={() => setSaved(null)}>Pour out more</button>
          <Link to="/" className="instrument instrument--quiet">Back to the sky</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="place plate clear">
      <header className="place__head">
        <p className="place__eyebrow">Clear my mind</p>
        <h1 className="place__title">Pour it all out</h1>
        <p className="place__lede">One thought per line. Worries, ideas, questions, small things. No need to decide anything yet.</p>
      </header>
      <textarea
        ref={ref}
        id="clear-text"
        className="clear__text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Should I ask about a role change?\nBook the dentist\nMaybe a guitar class on Saturdays\n…'}
        aria-label="Your thoughts, one per line"
        rows={10}
      />
      <div className="clear__foot">
        <div className="chips" role="group" aria-label="Which galaxy">
          <button type="button" className="chip" aria-pressed={galaxyId === null} onClick={() => setGalaxyId(null)}>No galaxy yet</button>
          {galaxiesOf(snap).map((g) => <button key={g.id} type="button" className="chip" aria-pressed={galaxyId === g.id} onClick={() => setGalaxyId(g.id)}>{g.name}</button>)}
        </div>
        <button type="button" className="instrument instrument--primary" disabled={!lines.length} onClick={() => void save()}>
          {lines.length ? `Put ${lines.length} in Unsorted` : 'Put them in Unsorted'}
        </button>
      </div>
      <p className="meta">Your words stay in this browser while you write, even if you close the page.</p>
    </div>
  );
}

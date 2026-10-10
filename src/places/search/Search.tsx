import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { openQuestions, search, type SearchHit } from '@/mind/select';
import { useMind } from '@/mind/store';
import { ThoughtGlyph } from '@/shell/Glyphs';
import './search.css';

const KIND_LABEL: Record<SearchHit['kind'], string> = { galaxy: 'Galaxies', goal: 'Goals', project: 'Projects', step: 'Steps', thought: 'Thoughts', journal: 'Journal' };
const ORDER: SearchHit['kind'][] = ['goal', 'thought', 'project', 'journal', 'step', 'galaxy'];

/** Find anything: goals, projects, steps, thoughts, journal entries. */
export default function Search() {
  const snap = useMind((s) => s.snap);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  const hits = useMemo(() => (snap ? search(snap, q) : []), [snap, q]);
  if (!snap) return null;
  const groups = ORDER.map((k) => ({ k, items: hits.filter((h) => h.kind === k) })).filter((g) => g.items.length);
  const questions = openQuestions(snap).slice(0, 6);

  return (
    <div className="place plate">
      <header className="place__head">
        <p className="place__eyebrow">Search</p>
        <input ref={ref} id="search-q" type="search" className="search__input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your mind" aria-label="Search your mind" />
      </header>
      {q.trim() === '' ? (
        questions.length > 0 && (
          <section className="place__section">
            <h2 className="place__h2">Open questions</h2>
            <ul className="rows">
              {questions.map((t) => (
                <li key={t.id}>
                  <Link className="hit" to={t.goalId ? `/goal/${t.goalId}` : t.projectId ? `/project/${t.projectId}` : '/unsorted'}>
                    <ThoughtGlyph question />
                    <span className="thought-text thought-text--q">{t.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="meta">The things you are unsure about. Answering one, even roughly, often clears the fog.</p>
          </section>
        )
      ) : groups.length === 0 ? (
        <p className="place__empty">Nothing matches “{q}”. Try fewer words.</p>
      ) : (
        groups.map(({ k, items }) => (
          <section key={k} className="place__section">
            <h2 className="place__h2">{KIND_LABEL[k]}</h2>
            <ul className="rows">
              {items.map((h) => (
                <li key={h.id}>
                  <Link className="hit" to={h.href}>
                    <span className="hit__title">{h.title}</span>
                    <span className="meta">{h.context}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

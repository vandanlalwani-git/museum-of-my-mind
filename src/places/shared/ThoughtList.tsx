import { useState } from 'react';
import { mindOps } from '@/mind/ops';
import type { Thought } from '@/mind/types';
import { relativeAge } from '@/lib/dates';
import { ThoughtGlyph } from '@/shell/Glyphs';
import { useUiStore } from '@/store/ui';

/** Thoughts around a goal or project. Open questions come first and can be answered here. */
export function ThoughtList({ thoughts, empty }: { thoughts: Thought[]; empty: string }) {
  if (!thoughts.length) return <p className="place__empty">{empty}</p>;
  return <ul className="rows">{thoughts.map((t) => <ThoughtRow key={t.id} t={t} />)}</ul>;
}

function ThoughtRow({ t }: { t: Thought }) {
  const say = useUiStore((s) => s.say);
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState(t.answer ?? '');
  const open = t.isQuestion && !t.answer;
  return (
    <li className="thoughtrow">
      <ThoughtGlyph question={open} />
      <div className="thoughtrow__body">
        <p className={`thought-text ${open ? 'thought-text--q' : ''}`}>{t.url ? <a href={t.url} target="_blank" rel="noreferrer noopener">{t.text}</a> : t.text}</p>
        {t.body && <p className="thoughtrow__note">{t.body}</p>}
        {t.answer && !answering && <p className="thoughtrow__answer"><span className="plaque">What I think now</span>{t.answer}</p>}
        {answering ? (
          <form className="thoughtrow__answerform" onSubmit={(e) => { e.preventDefault(); if (answer.trim()) void mindOps.answer(t.id, answer).then(() => { setAnswering(false); say('Written down. The question rests.'); }); }}>
            <textarea className="field__input field__textarea" rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Even a rough answer helps." aria-label="Your answer" autoFocus />
            <div className="form-actions">
              <button type="submit" className="instrument instrument--primary" disabled={!answer.trim()}>Keep this answer</button>
              <button type="button" className="instrument instrument--quiet" onClick={() => setAnswering(false)}>Not yet</button>
            </div>
          </form>
        ) : (
          <p className="meta">
            <span>{relativeAge(t.createdAt)}</span>
            {open && <span>· open question</span>}
            {t.tags.map((tag) => <span key={tag}>#{tag}</span>)}
            {t.isQuestion && <button type="button" className="quiet-btn" onClick={() => setAnswering(true)}>{t.answer ? 'Change the answer' : 'Write an answer'}</button>}
            <button type="button" className="quiet-btn" onClick={() => void mindOps.letGo(t.id).then(() => say('Let go. Search still finds it.'))}>Let go</button>
          </p>
        )}
      </div>
    </li>
  );
}

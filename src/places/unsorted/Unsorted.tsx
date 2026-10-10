import { useState } from 'react';
import { Link } from 'react-router-dom';
import { mindOps } from '@/mind/ops';
import { galaxiesOf, suggestHome, unsorted } from '@/mind/select';
import { useMind } from '@/mind/store';
import type { Thought } from '@/mind/types';
import { relativeAge } from '@/lib/dates';
import { HomePicker, type PickerMode, type Target } from '@/shell/HomePicker';
import { ThoughtGlyph } from '@/shell/Glyphs';
import { useUiStore } from '@/store/ui';
import './unsorted.css';

/** A pile you clear when you are ready. Nothing here is lost. */
export default function Unsorted() {
  const snap = useMind((s) => s.snap);
  const [filter, setFilter] = useState<string | 'all'>('all');
  if (!snap) return null;
  const all = unsorted(snap);
  const list = filter === 'all' ? all : all.filter((t) => (t.galaxyId ?? 'none') === filter);
  const galaxies = galaxiesOf(snap).filter((g) => all.some((t) => t.galaxyId === g.id));
  const loose = all.some((t) => t.galaxyId === null);

  return (
    <div className="place plate">
      <header className="place__head">
        <p className="place__eyebrow">Unsorted</p>
        <h1 className="place__title">{all.length === 0 ? 'Nothing is waiting' : `${all.length} ${all.length === 1 ? 'thought is' : 'thoughts are'} waiting`}</h1>
        <p className="place__lede">Give each one a home when you feel calm, or let it go. There is no rush, and nothing here is lost.</p>
        <div className="chips">
          <Link to="/clear" className="chip">Clear my mind</Link>
        </div>
      </header>

      {(galaxies.length > 1 || (galaxies.length > 0 && loose)) && (
        <div className="chips" role="group" aria-label="Show thoughts from">
          <button type="button" className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Everywhere</button>
          {galaxies.map((g) => <button key={g.id} type="button" className="chip" aria-pressed={filter === g.id} onClick={() => setFilter(g.id)}>{g.name}</button>)}
          {loose && <button type="button" className="chip" aria-pressed={filter === 'none'} onClick={() => setFilter('none')}>No galaxy yet</button>}
        </div>
      )}

      {list.length === 0 ? (
        <p className="place__empty">{all.length ? 'Nothing from this galaxy is waiting.' : 'When your head is full, capture everything with the gold button, or pour it all out with Clear my mind. It waits here.'}</p>
      ) : (
        <ul className="rows unsorted">
          {list.map((t) => <UnsortedThought key={t.id} t={t} />)}
        </ul>
      )}
    </div>
  );
}

type Panel = null | { mode: PickerMode; then: 'home' | 'step' | 'goal' | 'project' };

function UnsortedThought({ t }: { t: Thought }) {
  const snap = useMind((s) => s.snap)!;
  const say = useUiStore((s) => s.say);
  const [panel, setPanel] = useState<Panel>(null);
  const [leaving, setLeaving] = useState(false);
  const suggestion = suggestHome(snap, `${t.text} ${t.body ?? ''}`);
  const galaxy = snap.galaxies.find((g) => g.id === t.galaxyId);

  const done = (msg: string) => { setLeaving(true); window.setTimeout(() => say(msg), 10); };

  const linkSuggested = async () => {
    if (!suggestion) return;
    await mindOps.placeThought(t.id, suggestion.kind === 'goal' ? { goalId: suggestion.id } : { projectId: suggestion.id });
    done(`It now circles ${suggestion.title}.`);
  };

  const pick = async (target: Target) => {
    if (!panel) return;
    if (panel.then === 'home') {
      if (target.kind === 'galaxy') { await mindOps.placeThought(t.id, { galaxyId: target.id }); done(`Kept in ${target.title}, as an idea of its own.`); }
      else { await mindOps.placeThought(t.id, target.kind === 'goal' ? { goalId: target.id } : { projectId: target.id }); done(`It now circles ${target.title}.`); }
    } else if (panel.then === 'step' && target.kind === 'project') {
      await mindOps.thoughtToStep(t.id, target.id); done(`A step in ${target.title}.`);
    } else if (panel.then === 'goal' && target.kind === 'galaxy') {
      await mindOps.thoughtToGoal(t.id, target.id); done(`A new star in ${target.title}.`);
    } else if (panel.then === 'project') {
      const goal = target.kind === 'goal' ? snap.goals.find((g) => g.id === target.id) : undefined;
      const galaxyId = goal ? goal.galaxyId : target.id;
      await mindOps.thoughtToProject(t.id, galaxyId, goal ? goal.id : null); done(`A new planet${goal ? ` around ${goal.title}` : ''}.`);
    }
    setPanel(null);
  };

  return (
    <li className={`unsorted__item ${leaving ? 'unsorted__item--leaving' : ''}`}>
      <div className="unsorted__body">
        <ThoughtGlyph question={t.isQuestion} />
        <div className="unsorted__text">
          <p className={`thought-text ${t.isQuestion ? 'thought-text--q' : ''}`}>{t.url ? <a href={t.url} target="_blank" rel="noreferrer noopener">{t.text}</a> : t.text}</p>
          {t.body && <p className="unsorted__note">{t.body}</p>}
          <p className="meta">
            <span>{relativeAge(t.createdAt)}</span>
            {galaxy && <span>· {galaxy.name}</span>}
            {t.intent === 'step' && <span>· a step looking for a project</span>}
            {t.isQuestion && <span>· open question</span>}
          </p>
        </div>
      </div>

      {suggestion && !panel && t.intent !== 'step' && (
        <p className="unsorted__suggest">
          Looks related to <strong>{suggestion.title}</strong>.{' '}
          <button type="button" className="linkish" onClick={() => void linkSuggested()}>Link it there</button>
        </p>
      )}

      {panel ? (
        <div className="unsorted__panel">
          <HomePicker
            mode={panel.mode}
            prompt={panel.then === 'home' ? 'Where does it belong?' : panel.then === 'step' ? 'A step in which project?' : panel.then === 'goal' ? 'A star in which galaxy?' : 'Around which goal? Or in a galaxy with no goal yet.'}
            onPick={(target) => void pick(target)}
            onCancel={() => setPanel(null)}
          />
        </div>
      ) : (
        <div className="unsorted__actions">
          <button type="button" className="instrument" onClick={() => setPanel({ mode: t.intent === 'step' ? 'project' : 'home', then: t.intent === 'step' ? 'step' : 'home' })}>{t.intent === 'step' ? 'Choose its project' : 'Give it a home'}</button>
          <span className="unsorted__turn">
            Turn it into
            {t.intent !== 'step' && <button type="button" className="quiet-btn" onClick={() => setPanel({ mode: 'project', then: 'step' })}>a step</button>}
            <button type="button" className="quiet-btn" onClick={() => setPanel({ mode: 'galaxy', then: 'goal' })}>a goal</button>
            <button type="button" className="quiet-btn" onClick={() => setPanel({ mode: 'parent', then: 'project' })}>a project</button>
          </span>
          <button type="button" className="quiet-btn unsorted__letgo" onClick={() => { void mindOps.letGo(t.id); done('Let go. You can still find it in Search.'); }}>Let it go</button>
        </div>
      )}
    </li>
  );
}

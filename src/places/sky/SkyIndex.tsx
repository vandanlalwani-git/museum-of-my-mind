import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { mindOps } from '@/mind/ops';
import { brightness, freeThoughts, galaxiesOf, goalsIn, looseProjects, progressOf, projectsOf, unsorted } from '@/mind/select';
import { SHAPE_WORDS } from '@/mind/shapes';
import { useMind } from '@/mind/store';
import type { Galaxy } from '@/mind/types';
import { PlanetGlyph, StarGlyph, hueVar } from '@/shell/Glyphs';
import { useUiStore } from '@/store/ui';
import './sky.css';

/** The sky as a list: the same galaxies, goals and projects, laid out to scan. */
export function SkyIndex() {
  const snap = useMind((s) => s.snap);
  const [params, setParams] = useSearchParams();
  const only = params.get('galaxy');
  const [newGalaxy, setNewGalaxy] = useState('');
  const say = useUiStore((s) => s.say);
  if (!snap) return null;
  const galaxies = galaxiesOf(snap).filter((g) => !only || g.id === only);
  const waiting = unsorted(snap).length;

  const addGalaxy = async () => {
    if (!newGalaxy.trim()) return;
    const g = await mindOps.addGalaxy(newGalaxy);
    setNewGalaxy('');
    say(`${g.name} is in your sky.`);
  };

  return (
    <div className="place plate skyindex">
      <header className="skyindex__head">
        <p className="place__eyebrow">{only ? 'One galaxy' : 'Your sky, as a list'}</p>
        <h1 className="skyindex__title">{only ? galaxies[0]?.name : snap.mind.name}</h1>
        <p className="skyindex__lede">
          {waiting > 0 ? <><Link to="/unsorted">{waiting} {waiting === 1 ? 'thought is' : 'thoughts are'} waiting in Unsorted</Link>. Nothing is lost there.</> : 'Nothing is waiting in Unsorted.'}
          {only && <> · <button type="button" className="linkish" onClick={() => setParams({})}>Show every galaxy</button></>}
        </p>
      </header>

      {galaxies.map((g) => <GalaxySection key={g.id} galaxy={g} />)}

      {!only && (
        <form className="skyindex__newgalaxy" onSubmit={(e) => { e.preventDefault(); void addGalaxy(); }}>
          <label htmlFor="new-galaxy" className="place__eyebrow">A new galaxy</label>
          <div className="inline-add">
            <input id="new-galaxy" value={newGalaxy} onChange={(e) => setNewGalaxy(e.target.value)} placeholder="Health, a city, a side project…" />
            <button type="submit" className="instrument" disabled={!newGalaxy.trim()}>Add galaxy</button>
          </div>
          <p className="meta">An area of your life. Have as many as you like.</p>
        </form>
      )}
    </div>
  );
}

function GalaxySection({ galaxy }: { galaxy: Galaxy }) {
  const snap = useMind((s) => s.snap)!;
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const goals = goalsIn(snap, galaxy.id).filter((g) => g.state !== 'released');
  const loose = looseProjects(snap, galaxy.id);
  const ideas = freeThoughts(snap, galaxy.id);
  const drifting = unsorted(snap, galaxy.id).length;

  const add = async () => {
    if (!title.trim()) return;
    await mindOps.addGoal({ galaxyId: galaxy.id, title, why });
    setTitle(''); setWhy(''); setAdding(false);
  };

  return (
    <section className="galaxy" style={{ ['--tint' as string]: hueVar(galaxy.hue) }} aria-labelledby={`gx-${galaxy.id}`}>
      <header className="galaxy__head">
        <span className="galaxy__mark" aria-hidden="true" />
        <h2 id={`gx-${galaxy.id}`} className="galaxy__name">{galaxy.name}</h2>
        <span className="meta">
          {goals.length} {goals.length === 1 ? 'goal' : 'goals'}
          {ideas.length > 0 && <> · {ideas.length} {ideas.length === 1 ? 'idea' : 'ideas'}</>}
          {drifting > 0 && <> · {drifting} drifting</>}
        </span>
      </header>

      {goals.length === 0 && !adding && (
        <p className="galaxy__empty">No stars here yet. A goal is a direction you could follow for years, not something you tick off today.</p>
      )}

      <ul className="galaxy__goals">
        {goals.map((g) => (
          <li key={g.id} className={`goalrow goalrow--${g.state}`}>
            <Link to={`/goal/${g.id}`} className="goalrow__link">
              <StarGlyph brightness={brightness(snap, g.id)} size={26} />
              <span className="goalrow__text">
                <span className="goalrow__title">{g.title}</span>
                {g.why && <span className="goalrow__why">“{g.why}”</span>}
              </span>
              {g.state !== 'active' && <span className="meta">{g.state === 'resting' ? 'resting' : 'reached'}</span>}
            </Link>
            {projectsOf(snap, g.id).filter((p) => p.state !== 'dropped').length > 0 && (
              <ul className="goalrow__projects">
                {projectsOf(snap, g.id).filter((p) => p.state !== 'dropped').map((p) => (
                  <li key={p.id}>
                    <Link to={`/project/${p.id}`} className="projrow">
                      <PlanetGlyph progress={progressOf(snap, p)} shape={p.shape.kind} size={28} />
                      <span className="projrow__title">{p.title}</span>
                      <span className="meta">{p.state === 'finished' ? 'finished' : SHAPE_WORDS[p.shape.kind].toLowerCase()}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {loose.map((p) => (
          <li key={p.id} className="goalrow">
            <Link to={`/project/${p.id}`} className="projrow projrow--loose">
              <PlanetGlyph progress={progressOf(snap, p)} shape={p.shape.kind} size={28} />
              <span className="projrow__title">{p.title}</span>
              <span className="meta">a planet with no star yet</span>
            </Link>
          </li>
        ))}
      </ul>

      {adding ? (
        <form className="goalform" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <label className="field"><span className="plaque">A direction</span><input className="field__input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Learn the guitar" autoFocus /></label>
          <label className="field"><span className="plaque">Why it matters (one line)</span><input className="field__input" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="I feel most like myself when I play." /></label>
          <div className="form-actions">
            <button type="submit" className="instrument instrument--primary" disabled={!title.trim()}>Set it in the sky</button>
            <button type="button" className="instrument instrument--quiet" onClick={() => setAdding(false)}>Not now</button>
          </div>
        </form>
      ) : (
        <button type="button" className="linkish galaxy__add" onClick={() => setAdding(true)}>+ A new goal in {galaxy.name}</button>
      )}
    </section>
  );
}

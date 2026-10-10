import { useMemo, useState } from 'react';
import { useMind } from '@/mind/store';
import { galaxiesOf, goalsIn, looseProjects, progressOf, projectsOf, brightness } from '@/mind/select';
import { PlanetGlyph, StarGlyph, hueVar } from './Glyphs';
import './picker.css';

export type Target = { kind: 'galaxy' | 'goal' | 'project'; id: string; title: string };
export type PickerMode = 'home' | 'project' | 'galaxy' | 'parent';

interface Props {
  mode: PickerMode;
  onPick: (t: Target) => void;
  onCancel?: () => void;
  /** Words shown above the list, such as "Which project?" */
  prompt?: string;
}

/** Choose where something belongs, by galaxy, goal and project. */
export function HomePicker({ mode, onPick, onCancel, prompt }: Props) {
  const snap = useMind((s) => s.snap);
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    if (!snap) return [];
    const match = (t: string) => !q.trim() || t.toLowerCase().includes(q.trim().toLowerCase());
    return galaxiesOf(snap).map((g) => {
      const goals = goalsIn(snap, g.id).filter((x) => x.state === 'active' || x.state === 'resting').map((goal) => ({
        goal,
        projects: projectsOf(snap, goal.id).filter((p) => p.state !== 'finished' && p.state !== 'dropped' && match(p.title)),
      }));
      const loose = looseProjects(snap, g.id).filter((p) => p.state !== 'finished' && p.state !== 'dropped' && match(p.title));
      return { g, goals: goals.filter((x) => match(x.goal.title) || x.projects.length), loose, show: match(g.name) };
    });
  }, [snap, q]);
  if (!snap) return null;
  const canGalaxy = mode === 'home' || mode === 'galaxy' || mode === 'parent';
  const canGoal = mode === 'home' || mode === 'parent';
  const canProject = mode === 'home' || mode === 'project';
  const empty = groups.every((x) => !x.goals.length && !x.loose.length && !(canGalaxy && x.show));

  return (
    <div className="picker">
      {prompt && <p className="picker__prompt">{prompt}</p>}
      {mode !== 'galaxy' && (
        <input className="picker__search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a goal or project" aria-label="Find a goal or project" />
      )}
      <ul className="picker__list">
        {groups.map(({ g, goals, loose, show }) => (
          <li key={g.id} className="picker__galaxy" style={{ ['--tint' as string]: hueVar(g.hue) }}>
            {canGalaxy && show ? (
              <button type="button" className="picker__row picker__row--galaxy" onClick={() => onPick({ kind: 'galaxy', id: g.id, title: g.name })}>
                <span className="picker__dot" />{mode === 'home' ? `Keep it in ${g.name}` : mode === 'parent' ? `${g.name}, no goal yet` : g.name}
              </button>
            ) : (goals.length > 0 || loose.length > 0) && <span className="picker__heading">{g.name}</span>}
            {mode !== 'galaxy' && (
              <ul>
                {goals.map(({ goal, projects }) => (
                  <li key={goal.id}>
                    {canGoal ? (
                      <button type="button" className="picker__row picker__row--goal" onClick={() => onPick({ kind: 'goal', id: goal.id, title: goal.title })}>
                        <StarGlyph brightness={brightness(snap, goal.id)} size={18} />{goal.title}
                      </button>
                    ) : projects.length > 0 && <span className="picker__sub">{goal.title}</span>}
                    {canProject && projects.length > 0 && (
                      <ul>
                        {projects.map((p) => (
                          <li key={p.id}>
                            <button type="button" className="picker__row picker__row--project" onClick={() => onPick({ kind: 'project', id: p.id, title: p.title })}>
                              <PlanetGlyph progress={progressOf(snap, p)} shape={p.shape.kind} size={20} />{p.title}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
                {canProject && loose.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="picker__row picker__row--project" onClick={() => onPick({ kind: 'project', id: p.id, title: p.title })}>
                      <PlanetGlyph progress={progressOf(snap, p)} shape={p.shape.kind} size={20} />{p.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {empty && <p className="picker__empty">{mode === 'project' ? 'No projects yet. Make one from a goal’s page, or turn this into a project instead.' : 'Nothing matches.'}</p>}
      {onCancel && <button type="button" className="picker__cancel" onClick={onCancel}>Cancel</button>}
    </div>
  );
}

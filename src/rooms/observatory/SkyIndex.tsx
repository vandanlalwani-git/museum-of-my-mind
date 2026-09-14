import { useState } from 'react';
import { Instrument } from '@/components/Instrument';
import type { Action, Goal, Project, ProjectStatus } from '@/types';
import { GoalForm } from './GoalForm';
import { HORIZON_LABEL, STATE_LABEL, type GoalOps } from './GoalPanel';
import { ProjectItem } from './ProjectItem';
import { isInSky, nextForGoal } from './layout';

interface Props {
  goals: Goal[];
  projects: Project[];
  actions: Action[];
  onSelect: (id: string) => void;
  onCreateGoal: (v: { title: string; why: string; horizon: Goal['horizon'] }) => Promise<void>;
  expandedProjectId: string | null;
  onExpandProject: (id: string | null) => void;
  ops: GoalOps;
}

export function SkyIndex({ goals, projects, actions, onSelect, onCreateGoal, expandedProjectId, onExpandProject, ops }: Props) {
  const [naming, setNaming] = useState(false);
  const inSky = goals.filter(isInSky).sort((a, b) => b.updatedAt - a.updatedAt);
  const beneath = goals.filter((g) => !isInSky(g)).sort((a, b) => b.updatedAt - a.updatedAt);
  const skyIds = new Set(inSky.map((g) => g.id));
  const adrift = projects.filter((p) => p.status !== 'abandoned' && p.status !== 'done' && !p.goalIds.some((id) => skyIds.has(id)));

  return (
    <div className="panel">
      <header className="panel__head">
        <span className="plaque">Constellations · {inSky.length}</span>
        <h2 className="panel__title">The sky tonight</h2>
        <p className="panel__why">Each goal is a constellation. Choose one to see what orbits it and what to do next.</p>
      </header>

      {naming ? (
        <GoalForm onSubmit={async (v) => { await onCreateGoal(v); setNaming(false); }} onCancel={() => setNaming(false)} />
      ) : (
        <div className="form-actions"><Instrument tone="primary" onClick={() => setNaming(true)}>Name a goal</Instrument></div>
      )}

      <ul className="index">
        {inSky.map((g) => {
          const count = projects.filter((p) => p.goalIds.includes(g.id) && p.status !== 'done' && p.status !== 'abandoned').length;
          const next = nextForGoal(g.id, projects, actions);
          return (
            <li key={g.id}>
              <button type="button" className={`index__item ${g.state === 'dormant' ? 'is-dormant' : ''}`} onClick={() => onSelect(g.id)}>
                <span className="index__star" aria-hidden="true" />
                <span className="index__text">
                  <span className="index__title display">{g.title}</span>
                  <span className="plaque">{HORIZON_LABEL[g.horizon]} · {count} in orbit{g.state === 'dormant' ? ' · resting' : ''}</span>
                  {next && <span className="index__next">Next: {next.action.text}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {beneath.length > 0 && (
        <section className="panel__section">
          <div className="panel__section-head"><span className="plaque">Beneath the horizon · {beneath.length}</span></div>
          <ul className="index index--beneath">
            {beneath.map((g) => (
              <li key={g.id}>
                <button type="button" className="index__item is-beneath" onClick={() => onSelect(g.id)}>
                  <span className="index__text">
                    <span className="index__title display">{g.title}</span>
                    <span className="plaque">{STATE_LABEL[g.state]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {adrift.length > 0 && (
        <section className="panel__section">
          <div className="panel__section-head"><span className="plaque">Adrift · {adrift.length}</span></div>
          <p className="panel__empty">Projects without a goal in the sky. Open one to give it a goal, finish it, or set it aside.</p>
          <ul className="projects">
            {adrift.map((p) => (
              <ProjectItem
                key={p.id}
                project={p}
                actions={actions.filter((a) => a.projectId === p.id)}
                isNext={false}
                expanded={expandedProjectId === p.id}
                onToggle={() => onExpandProject(expandedProjectId === p.id ? null : p.id)}
                onUpdate={(patch) => ops.updateProject(p, patch)}
                onStatus={(s: ProjectStatus) => ops.setProjectStatus(p, s)}
                onAddAction={(t) => ops.addAction(p.id, t)}
                onToggleAction={ops.toggleAction}
                onRemoveAction={ops.removeAction}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

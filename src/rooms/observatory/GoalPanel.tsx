import { useState, type FormEvent } from 'react';
import { Instrument } from '@/components/Instrument';
import { TextArea, TextField } from '@/components/Field';
import { relativeAge } from '@/lib/dates';
import type { Action, Goal, GoalState, Horizon, Project, ProjectStatus } from '@/types';
import { GoalForm } from './GoalForm';
import { ProjectItem } from './ProjectItem';
import { nextForGoal } from './layout';

export const HORIZON_LABEL: Record<Horizon, string> = { season: 'This season', year: 'This year', decade: 'This decade', lifetime: 'A lifetime' };
export const STATE_LABEL: Record<GoalState, string> = { active: 'In the sky', dormant: 'Resting', fulfilled: 'Fulfilled', released: 'Released' };

export interface GoalOps {
  updateGoal: (goal: Goal, patch: Partial<Goal>) => Promise<void>;
  setGoalState: (goal: Goal, state: GoalState) => Promise<void>;
  createProject: (goalId: string, input: { title: string; summary: string }) => Promise<Project>;
  updateProject: (project: Project, patch: Partial<Project>) => Promise<void>;
  setProjectStatus: (project: Project, status: ProjectStatus) => Promise<void>;
  addAction: (projectId: string, text: string) => Promise<void>;
  toggleAction: (action: Action) => Promise<void>;
  removeAction: (action: Action) => Promise<void>;
}

interface Props {
  goal: Goal;
  projects: Project[];
  actions: Action[];
  expandedProjectId: string | null;
  onExpandProject: (id: string | null) => void;
  onBack: () => void;
  ops: GoalOps;
}

export function GoalPanel({ goal, projects, actions, expandedProjectId, onExpandProject, onBack, ops }: Props) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const mine = projects.filter((p) => p.goalIds.includes(goal.id));
  const inOrbit = mine.filter((p) => p.status !== 'done' && p.status !== 'abandoned').sort(byStatus);
  const beneath = mine.filter((p) => p.status === 'done' || p.status === 'abandoned').sort((a, b) => b.updatedAt - a.updatedAt);
  const next = nextForGoal(goal.id, projects, actions);

  return (
    <div className="panel">
      <button type="button" className="panel__back plaque" onClick={onBack}>← All constellations</button>

      {editing ? (
        <GoalForm
          initial={goal}
          submitLabel="Save"
          onSubmit={async (v) => { await ops.updateGoal(goal, v); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <header className="panel__head">
          <span className="plaque">{HORIZON_LABEL[goal.horizon]} · {STATE_LABEL[goal.state]}</span>
          <h2 className="panel__title">{goal.title}</h2>
          {goal.why && <p className="panel__why">{goal.why}</p>}
          <p className="panel__age">Set {relativeAge(goal.createdAt)} · touched {relativeAge(goal.lastVisitedAt)}</p>
          <div className="form-actions">
            <Instrument tone="quiet" onClick={() => setEditing(true)}>Edit</Instrument>
            {goal.state === 'active' && <Instrument tone="quiet" onClick={() => void ops.setGoalState(goal, 'dormant')}>Let it rest</Instrument>}
            {goal.state !== 'active' && <Instrument tone="quiet" onClick={() => void ops.setGoalState(goal, 'active')}>{goal.state === 'dormant' ? 'Wake it' : 'Return it to the sky'}</Instrument>}
            {goal.state !== 'fulfilled' && <Instrument tone="quiet" onClick={() => void ops.setGoalState(goal, 'fulfilled')}>Fulfilled</Instrument>}
            {goal.state !== 'released' && goal.state !== 'fulfilled' && <Instrument tone="quiet" onClick={() => void ops.setGoalState(goal, 'released')}>Release it</Instrument>}
          </div>
        </header>
      )}

      {next ? (
        <div className="panel__next">
          <span className="plaque">Next</span>
          <p className="panel__next-text display">{next.action.text}</p>
          <p className="panel__next-project">for {next.project.title}</p>
        </div>
      ) : inOrbit.length > 0 ? (
        <div className="panel__next panel__next--empty">
          <span className="plaque">Next</span>
          <p className="panel__next-project">Nothing is lit. Open a project and name its next step.</p>
        </div>
      ) : null}

      <section className="panel__section">
        <div className="panel__section-head">
          <span className="plaque">In orbit · {inOrbit.length}</span>
          {!adding && <Instrument tone="quiet" onClick={() => setAdding(true)}>Add a project</Instrument>}
        </div>
        {adding && (
          <NewProject onCancel={() => setAdding(false)} onSubmit={async (v) => { const p = await ops.createProject(goal.id, v); setAdding(false); onExpandProject(p.id); }} />
        )}
        {inOrbit.length === 0 && !adding && (
          <p className="panel__empty">No projects orbit this goal yet. A project is a bounded piece of work with an end.</p>
        )}
        <ul className="projects">
          {inOrbit.map((p) => (
            <ProjectItem
              key={p.id}
              project={p}
              actions={actions.filter((a) => a.projectId === p.id)}
              isNext={next?.project.id === p.id}
              expanded={expandedProjectId === p.id}
              onToggle={() => onExpandProject(expandedProjectId === p.id ? null : p.id)}
              onUpdate={(patch) => ops.updateProject(p, patch)}
              onStatus={(s) => ops.setProjectStatus(p, s)}
              onAddAction={(t) => ops.addAction(p.id, t)}
              onToggleAction={ops.toggleAction}
              onRemoveAction={ops.removeAction}
            />
          ))}
        </ul>
      </section>

      {beneath.length > 0 && (
        <section className="panel__section">
          <div className="panel__section-head"><span className="plaque">Beneath the horizon · {beneath.length}</span></div>
          <ul className="projects projects--beneath">
            {beneath.map((p) => (
              <ProjectItem
                key={p.id}
                project={p}
                actions={actions.filter((a) => a.projectId === p.id)}
                isNext={false}
                expanded={expandedProjectId === p.id}
                onToggle={() => onExpandProject(expandedProjectId === p.id ? null : p.id)}
                onUpdate={(patch) => ops.updateProject(p, patch)}
                onStatus={(s) => ops.setProjectStatus(p, s)}
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

function NewProject({ onSubmit, onCancel }: { onSubmit: (v: { title: string; summary: string }) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); if (title.trim()) void onSubmit({ title: title.trim(), summary: summary.trim() }); };
  return (
    <form className="goal-form" onSubmit={submit}>
      <TextField label="Project" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Something with an end" maxLength={120} autoFocus required />
      <TextArea label="What it is" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One or two lines." maxLength={600} rows={2} />
      <div className="form-actions">
        <Instrument tone="primary" type="submit" disabled={!title.trim()}>Set it in orbit</Instrument>
        <Instrument tone="quiet" type="button" onClick={onCancel}>Cancel</Instrument>
      </div>
    </form>
  );
}

const ORDER: Record<ProjectStatus, number> = { active: 0, paused: 1, idea: 2, done: 3, abandoned: 4 };
function byStatus(a: Project, b: Project) { return ORDER[a.status] - ORDER[b.status] || b.updatedAt - a.updatedAt; }

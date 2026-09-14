import { useState } from 'react';
import { Instrument } from '@/components/Instrument';
import { ActionList } from '@/components/ActionList';
import { ProjectEditor } from '@/components/ProjectEditor';
import { relativeAge } from '@/lib/dates';
import { STATUS_LABEL, type MuseumOps } from '@/store/ops';
import type { Action, Goal, Project } from '@/types';
import { nextActionFor } from './layout';

interface Props {
  project: Project;
  actions: Action[];
  goals: Goal[];
  isNext: boolean;
  expanded: boolean;
  onToggle: () => void;
  ops: MuseumOps;
}

export function ProjectItem({ project, actions, goals, isNext, expanded, onToggle, ops }: Props) {
  const [editing, setEditing] = useState(false);
  const next = nextActionFor(project.id, actions);

  return (
    <li className={`project ${expanded ? 'is-open' : ''} ${isNext ? 'is-next' : ''} project--${project.status}`}>
      <button type="button" className="project__head" onClick={onToggle} aria-expanded={expanded}>
        <span className="project__star" aria-hidden="true" />
        <span className="project__text">
          <span className="project__title display">{project.title}</span>
          <span className="project__meta">
            <span className="plaque">{STATUS_LABEL[project.status]}</span>
            {next && !expanded && <span className="project__next">{isNext ? 'Next: ' : ''}{next.text}</span>}
          </span>
        </span>
        <span className="project__progress" aria-label={`${Math.round(project.progress * 100)} percent`}>
          <span style={{ width: `${Math.round(project.progress * 100)}%` }} />
        </span>
      </button>

      {expanded && (
        <div className="project__body">
          {editing ? (
            <ProjectEditor project={project} goals={goals} onSave={async (patch) => { await ops.updateProject(project, patch); setEditing(false); }} onCancel={() => setEditing(false)} />
          ) : (
            <>
              {project.summary && <p className="project__summary">{project.summary}</p>}
              <p className="project__age">Touched {relativeAge(project.lastVisitedAt)}</p>
              <div className="form-actions">
                <Instrument tone="quiet" onClick={() => setEditing(true)}>Edit</Instrument>
                {project.status !== 'active' && <Instrument tone="quiet" onClick={() => void ops.setProjectStatus(project, 'active')}>{project.status === 'done' || project.status === 'abandoned' ? 'Revisit' : 'Set in motion'}</Instrument>}
                {project.status === 'active' && <Instrument tone="quiet" onClick={() => void ops.setProjectStatus(project, 'paused')}>Let it rest</Instrument>}
                {project.status !== 'done' && <Instrument tone="quiet" onClick={() => void ops.setProjectStatus(project, 'done')}>Finished</Instrument>}
                {project.status !== 'abandoned' && project.status !== 'done' && <Instrument tone="quiet" onClick={() => void ops.setProjectStatus(project, 'abandoned')}>Set aside</Instrument>}
              </div>
            </>
          )}
          <ActionList
            actions={actions}
            emphasiseNext={project.status === 'active'}
            onToggle={ops.toggleAction}
            onRemove={ops.removeAction}
            onAdd={async (t) => { await ops.addAction(project.id, t); }}
          />
        </div>
      )}
    </li>
  );
}

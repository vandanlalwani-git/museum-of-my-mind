import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Instrument } from '@/components/Instrument';
import { RangeField, SelectField, TextArea, TextField } from '@/components/Field';
import { relativeAge } from '@/lib/dates';
import type { Action, Project, ProjectStatus } from '@/types';
import { nextActionFor } from './layout';

const STATUS_LABEL: Record<ProjectStatus, string> = {
  idea: 'An idea', active: 'In motion', paused: 'Resting', done: 'Finished', abandoned: 'Set aside',
};

interface Props {
  project: Project;
  actions: Action[];
  isNext: boolean;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<Project>) => Promise<void>;
  onStatus: (status: ProjectStatus) => Promise<void>;
  onAddAction: (text: string) => Promise<void>;
  onToggleAction: (action: Action) => Promise<void>;
  onRemoveAction: (action: Action) => Promise<void>;
}

export function ProjectItem(p: Props) {
  const { project, actions, isNext, expanded, onToggle } = p;
  const [editing, setEditing] = useState(false);
  const [newAction, setNewAction] = useState('');
  const open = actions.filter((a) => !a.doneAt).sort((a, b) => a.createdAt - b.createdAt);
  const done = actions.filter((a) => a.doneAt).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  const next = nextActionFor(project.id, actions);

  const add = async (e: FormEvent | KeyboardEvent) => {
    e.preventDefault();
    if (!newAction.trim()) return;
    await p.onAddAction(newAction);
    setNewAction('');
  };

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
            <ProjectEditor project={project} onSave={async (patch) => { await p.onUpdate(patch); setEditing(false); }} onCancel={() => setEditing(false)} />
          ) : (
            <>
              {project.summary && <p className="project__summary">{project.summary}</p>}
              <p className="project__age">Touched {relativeAge(project.lastVisitedAt)}</p>
              <div className="form-actions">
                <Instrument tone="quiet" onClick={() => setEditing(true)}>Edit</Instrument>
                {project.status !== 'active' && <Instrument tone="quiet" onClick={() => void p.onStatus('active')}>{project.status === 'done' || project.status === 'abandoned' ? 'Revisit' : 'Set in motion'}</Instrument>}
                {project.status === 'active' && <Instrument tone="quiet" onClick={() => void p.onStatus('paused')}>Let it rest</Instrument>}
                {project.status !== 'done' && <Instrument tone="quiet" onClick={() => void p.onStatus('done')}>Finished</Instrument>}
                {project.status !== 'abandoned' && project.status !== 'done' && <Instrument tone="quiet" onClick={() => void p.onStatus('abandoned')}>Set aside</Instrument>}
              </div>
            </>
          )}

          <ul className="actions">
            {open.map((a, i) => (
              <li key={a.id} className={`action ${i === 0 && project.status === 'active' ? 'action--next' : ''}`}>
                <button type="button" className="action__check" aria-label={`Mark done: ${a.text}`} onClick={() => void p.onToggleAction(a)} />
                <span className="action__text">{a.text}</span>
                <button type="button" className="action__remove" aria-label={`Let go of: ${a.text}`} onClick={() => void p.onRemoveAction(a)}>×</button>
              </li>
            ))}
            {done.map((a) => (
              <li key={a.id} className="action action--done">
                <button type="button" className="action__check is-done" aria-label={`Undo: ${a.text}`} onClick={() => void p.onToggleAction(a)} />
                <span className="action__text">{a.text}</span>
              </li>
            ))}
          </ul>
          <form className="action-add" onSubmit={add}>
            <input
              value={newAction}
              onChange={(e) => setNewAction(e.target.value)}
              placeholder={open.length ? 'Another next step' : 'What is the next physical step?'}
              maxLength={200}
              aria-label="New next action"
              onKeyDown={(e) => { if (e.key === 'Enter') void add(e); }}
            />
            <Instrument tone="quiet" type="submit" disabled={!newAction.trim()}>Add</Instrument>
          </form>
        </div>
      )}
    </li>
  );
}

function ProjectEditor({ project, onSave, onCancel }: { project: Project; onSave: (patch: Partial<Project>) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState(project.title);
  const [summary, setSummary] = useState(project.summary);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [progress, setProgress] = useState(Math.round(project.progress * 100));
  return (
    <form className="goal-form" onSubmit={(e) => { e.preventDefault(); void onSave({ title: title.trim(), summary: summary.trim(), status, progress: progress / 100 }); }}>
      <TextField label="Project" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required autoFocus />
      <TextArea label="What it is" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={600} />
      <SelectField label="State" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
        {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </SelectField>
      <RangeField label="Progress" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
      <div className="form-actions">
        <Instrument tone="primary" type="submit" disabled={!title.trim()}>Save</Instrument>
        <Instrument tone="quiet" type="button" onClick={onCancel}>Cancel</Instrument>
      </div>
    </form>
  );
}

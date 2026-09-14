import { useState, type FormEvent } from 'react';
import { Instrument } from '@/components/Instrument';
import { RangeField, SelectField, TextArea, TextField } from '@/components/Field';
import { parseTags } from '@/lib/text';
import { STATUS_LABEL } from '@/store/ops';
import type { Goal, Project, ProjectStatus } from '@/types';

interface Props {
  project: Project;
  goals: Goal[];
  onSave: (patch: Partial<Project>) => Promise<void>;
  onCancel: () => void;
}

/** Edit a project: title, summary, state, progress, the goals it serves, and tags. */
export function ProjectEditor({ project, goals, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(project.title);
  const [summary, setSummary] = useState(project.summary);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [progress, setProgress] = useState(Math.round(project.progress * 100));
  const [goalIds, setGoalIds] = useState<string[]>(project.goalIds);
  const [tags, setTags] = useState(project.tags.join(', '));
  const inSky = goals.filter((g) => g.state === 'active' || g.state === 'dormant' || project.goalIds.includes(g.id));

  const toggleGoal = (id: string) => setGoalIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <form className="goal-form" onSubmit={(e: FormEvent) => { e.preventDefault(); if (title.trim()) void onSave({ title: title.trim(), summary: summary.trim(), status, progress: progress / 100, goalIds, tags: parseTags(tags) }); }}>
      <TextField label="Project" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required autoFocus />
      <TextArea label="What it is" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={600} rows={3} />
      <SelectField label="State" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
        {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </SelectField>
      <RangeField label="Progress" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
      <fieldset className="checkset">
        <legend className="plaque">Serves</legend>
        {inSky.length === 0 && <p className="panel__empty">No goals in the sky yet. A project can stand alone.</p>}
        {inSky.map((g) => (
          <label key={g.id} className="checkset__item">
            <input type="checkbox" checked={goalIds.includes(g.id)} onChange={() => toggleGoal(g.id)} /> {g.title}
          </label>
        ))}
      </fieldset>
      <TextField label="Tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="health, running" />
      <div className="form-actions">
        <Instrument tone="primary" type="submit" disabled={!title.trim()}>Save</Instrument>
        <Instrument tone="quiet" type="button" onClick={onCancel}>Cancel</Instrument>
      </div>
    </form>
  );
}

import { relativeAge } from '@/lib/dates';
import { STATUS_LABEL } from '@/store/ops';
import type { Action, Goal, Project } from '@/types';
import { nextOpenAction } from './pickup';

interface Props {
  project: Project;
  actions: Action[];
  goals: Goal[];
  selected: boolean;
  now: number;
  reasons?: string[];
  onOpen: () => void;
}

const DAY = 86_400_000;

/**
 * A project as a thing on the bench: a dial for progress, a plaque, a line
 * of dust proportional to how long it has sat, a lamp when it is in motion,
 * a cloth when it has been set aside.
 */
export function Artifact({ project, actions, goals, selected, now, reasons, onOpen }: Props) {
  const days = Math.max(0, Math.floor((now - project.lastVisitedAt) / DAY));
  const dust = project.status === 'done' ? 0 : Math.min(days / 120, 0.6);
  const next = nextOpenAction(project.id, actions);
  const served = goals.filter((g) => project.goalIds.includes(g.id));
  const pct = Math.round(project.progress * 100);
  const r = 15, c = 2 * Math.PI * r;

  return (
    <button
      type="button"
      className={`artifact artifact--${project.status} ${selected ? 'is-selected' : ''} ${reasons ? 'artifact--pickup' : ''}`}
      style={{ ['--dust' as string]: dust }}
      onClick={onOpen}
      aria-pressed={selected}
      aria-label={`${project.title}. ${STATUS_LABEL[project.status]}. ${pct} percent. Touched ${relativeAge(project.lastVisitedAt, now)}.${next ? ` Next: ${next.text}.` : ''}`}
    >
      <span className="artifact__lamp" aria-hidden="true" />
      <span className="artifact__cloth" aria-hidden="true" />
      <span className="artifact__top">
        <svg className="artifact__dial" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r={r} className="artifact__dial-track" />
          <circle cx="20" cy="20" r={r} className="artifact__dial-fill" strokeDasharray={`${c * project.progress} ${c}`} transform="rotate(-90 20 20)" />
          <text x="20" y="21.5" textAnchor="middle" className="artifact__dial-text">{pct}</text>
        </svg>
        <span className="artifact__plaque plaque">{STATUS_LABEL[project.status]}</span>
      </span>
      <span className="artifact__title display">{project.title}</span>
      {project.summary && <span className="artifact__summary">{project.summary}</span>}
      <span className="artifact__foot">
        {served.length > 0 && <span className="artifact__goal">for {served.map((g) => g.title).join(' · ')}</span>}
        <span className="artifact__age plaque">Touched {relativeAge(project.lastVisitedAt, now)}</span>
        {next && project.status !== 'done' && project.status !== 'abandoned' && <span className="artifact__next"><span className="artifact__next-dot" aria-hidden="true" />{next.text}</span>}
      </span>
      {reasons && reasons[0] && (
        <span className="artifact__why">
          <span>{reasons[0]}</span>
          {reasons.length > 1 && <span className="artifact__why-more">{reasons.length - 1} more reason{reasons.length - 1 === 1 ? '' : 's'} inside</span>}
        </span>
      )}
      {project.status === 'done' && <span className="artifact__seal plaque" aria-hidden="true">done</span>}
    </button>
  );
}

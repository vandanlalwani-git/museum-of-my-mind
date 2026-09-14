import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Instrument } from '@/components/Instrument';
import { ActionList } from '@/components/ActionList';
import { ProjectEditor } from '@/components/ProjectEditor';
import { relativeAge } from '@/lib/dates';
import { STATUS_LABEL, type MuseumOps } from '@/store/ops';
import { THREAD_LABEL, type MuseumRecords, type Project } from '@/types';
import { nextOpenAction } from './pickup';

interface Props {
  project: Project;
  records: MuseumRecords;
  ops: MuseumOps;
  now: number;
  reasons?: string[];
  onBack: () => void;
  onDeleted: () => void;
}

export function ProjectPanel({ project, records, ops, now, reasons, onBack, onDeleted }: Props) {
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm-delete'>('view');
  const actions = records.actions.filter((a) => a.projectId === project.id);
  const next = nextOpenAction(project.id, actions);
  const served = records.goals.filter((g) => project.goalIds.includes(g.id));
  const threads = records.threads.filter((t) => t.fromId === project.id || t.toId === project.id);
  const titles = useMemo(() => {
    const m = new Map<string, { title: string; to: string }>();
    for (const n of records.notes) m.set(n.id, { title: n.title, to: `/archive?item=${n.id}` });
    for (const l of records.links) m.set(l.id, { title: l.title, to: `/archive?item=${l.id}` });
    for (const mem of records.memories) m.set(mem.id, { title: mem.title, to: `/archive?item=${mem.id}` });
    for (const g of records.goals) m.set(g.id, { title: g.title, to: `/observatory?goal=${g.id}` });
    for (const p of records.projects) m.set(p.id, { title: p.title, to: `/workshop?project=${p.id}` });
    return m;
  }, [records]);
  const done = actions.filter((a) => a.doneAt).length;

  return (
    <div className="panel">
      <button type="button" className="panel__back plaque" onClick={onBack}>← The bench</button>

      {mode === 'edit' ? (
        <ProjectEditor project={project} goals={records.goals} onSave={async (patch) => { await ops.updateProject(project, patch); setMode('view'); }} onCancel={() => setMode('view')} />
      ) : (
        <header className="panel__head">
          <span className="plaque">{STATUS_LABEL[project.status]} · {Math.round(project.progress * 100)}% · {done}/{actions.length} steps done</span>
          <h2 className="panel__title">{project.title}</h2>
          {project.summary && <p className="panel__why">{project.summary}</p>}
          <p className="panel__age">Started {relativeAge(project.createdAt, now)} · touched {relativeAge(project.lastVisitedAt, now)}</p>
          {served.length > 0 ? (
            <p className="ws-serves">
              <span className="plaque">Serves</span>{' '}
              {served.map((g, i) => (
                <span key={g.id}>{i > 0 && ', '}<RouterLink to={`/observatory?goal=${g.id}`} className="ws-goal">{g.title}</RouterLink></span>
              ))}
            </p>
          ) : (
            <p className="panel__empty">Serves no goal yet. Edit it to tie it to one.</p>
          )}
          {project.tags.length > 0 && <p className="plaque">{project.tags.join(' · ')}</p>}
          <div className="form-actions">
            <Instrument tone="quiet" onClick={() => setMode('edit')}>Edit</Instrument>
            {project.status !== 'active' && <Instrument tone="quiet" onClick={() => void ops.setProjectStatus(project, 'active')}>{project.status === 'done' || project.status === 'abandoned' ? 'Revisit' : 'Set in motion'}</Instrument>}
            {project.status === 'active' && <Instrument tone="quiet" onClick={() => void ops.setProjectStatus(project, 'paused')}>Let it rest</Instrument>}
            {project.status !== 'done' && <Instrument tone="quiet" onClick={() => void ops.setProjectStatus(project, 'done')}>Finished</Instrument>}
            {project.status !== 'abandoned' && project.status !== 'done' && <Instrument tone="quiet" onClick={() => void ops.setProjectStatus(project, 'abandoned')}>Set aside</Instrument>}
            <Instrument tone="quiet" onClick={() => setMode('confirm-delete')}>Let it go</Instrument>
          </div>
        </header>
      )}

      {mode === 'confirm-delete' && (
        <div className="panel__next panel__next--empty">
          <span className="plaque">Let it go?</span>
          <p className="panel__next-project">This removes the project, its {actions.length} step{actions.length === 1 ? '' : 's'}, and its threads for good. Setting it aside keeps it on the shelf.</p>
          <div className="form-actions">
            <Instrument tone="ember" onClick={async () => { await ops.deleteProject(project); onDeleted(); }}>Let it go</Instrument>
            <Instrument tone="quiet" onClick={() => setMode('view')}>Keep it</Instrument>
          </div>
        </div>
      )}

      {reasons && (
        <div className="panel__next">
          <span className="plaque">Why it is on the table</span>
          {reasons.map((r, i) => <p key={i} className="panel__next-project">{r}</p>)}
        </div>
      )}

      {next && project.status !== 'done' && project.status !== 'abandoned' ? (
        <div className="panel__next">
          <span className="plaque">Smallest next step</span>
          <p className="panel__next-text display">{next.text}</p>
        </div>
      ) : project.status !== 'done' && project.status !== 'abandoned' ? (
        <div className="panel__next panel__next--empty">
          <span className="plaque">Smallest next step</span>
          <p className="panel__next-project">None named. Add one below; the smaller the better.</p>
        </div>
      ) : null}

      <section className="panel__section">
        <div className="panel__section-head"><span className="plaque">Steps · {actions.length}</span></div>
        <ActionList
          actions={actions}
          emphasiseNext={project.status === 'active' || project.status === 'paused'}
          onToggle={ops.toggleAction}
          onRemove={ops.removeAction}
          onAdd={async (t) => { await ops.addAction(project.id, t); }}
        />
      </section>

      {threads.length > 0 && (
        <section className="panel__section">
          <div className="panel__section-head"><span className="plaque">Threads · {threads.length}</span></div>
          <ul className="threads">
            {threads.map((t) => {
              const outgoing = t.fromId === project.id;
              const other = titles.get(outgoing ? t.toId : t.fromId);
              return (
                <li key={t.id} className="thread">
                  <p className="thread__line">
                    {outgoing ? <em>This</em> : (other ? <RouterLink className="thread__target" to={other.to}>{other.title}</RouterLink> : <span className="thread__target--gone">something gone</span>)}
                    {' '}<span className="thread__kind">{THREAD_LABEL[t.kind]}</span>{' '}
                    {outgoing ? (other ? <RouterLink className="thread__target" to={other.to}>{other.title}</RouterLink> : <span className="thread__target--gone">something gone</span>) : <em>this</em>}
                  </p>
                  {t.why && <p className="thread__why">“{t.why}”</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Instrument } from '@/components/Instrument';
import { StarField } from '@/components/StarField';
import { makeLink, makeNote, touched } from '@/data/factories';
import { META_KEYS, metaRepo } from '@/data/repo/meta';
import { relativeAge, timeOfDayGreeting } from '@/lib/dates';
import { splitCapture } from '@/lib/text';
import { useMuseumStore } from '@/store/museum';
import { useMuseumOps } from '@/store/ops';
import { useUiStore } from '@/store/ui';
import type { Goal, RecordType } from '@/types';
import { Capture, type CaptureAs } from './Capture';
import { focusProgress, forgottenOne, nextStepFor, projectsNeedingAStep, resolveFocus } from './selection';
import './today.css';

const DAY = 86_400_000;

type Kept = { id: string; type: RecordType; text: string; as: CaptureAs } | null;

export default function Today() {
  const museumId = useMuseumStore((s) => s.activeMuseumId)!;
  const active = useMuseumStore((s) => s.active);
  const records = useMuseumStore((s) => s.records);
  const upsert = useMuseumStore((s) => s.upsert);
  const remove = useMuseumStore((s) => s.remove);
  const ops = useMuseumOps();
  const say = useUiStore((s) => s.say);

  const [now] = useState(() => Date.now());
  const [pinned, setPinned] = useState<string | null>(null);
  const [loadedPin, setLoadedPin] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [pickingStep, setPickingStep] = useState(false);
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [kept, setKept] = useState<Kept>(null);
  const [newStep, setNewStep] = useState('');

  useEffect(() => {
    void metaRepo.get<string>(META_KEYS.focusGoal(museumId)).then((v) => { setPinned(v ?? null); setLoadedPin(true); });
  }, [museumId]);

  const focus = useMemo(() => resolveFocus(records, pinned), [records, pinned]);
  const goal = focus.goal;
  const step = useMemo(() => (goal ? nextStepFor(records, goal.id, now) : null), [records, goal, now]);
  const needsStep = useMemo(() => (goal ? projectsNeedingAStep(records, goal.id, now) : []), [records, goal, now]);
  const progress = useMemo(() => (goal ? focusProgress(records, goal.id) : null), [records, goal]);
  const forgotten = useMemo(() => forgottenOne(records, now, museumId, skipped), [records, now, museumId, skipped]);

  const pick = async (g: Goal) => {
    setPinned(g.id);
    setChoosing(false);
    await metaRepo.set(META_KEYS.focusGoal(museumId), g.id);
  };

  const capture = useCallback(async (text: string, as: CaptureAs) => {
    if (as === 'link') {
      const [url, ...rest] = text.split(/\s+/);
      const item = makeLink(museumId, { url: url!, whySaved: rest.join(' ') });
      await upsert('links', item);
      setKept({ id: item.id, type: 'links', text, as: 'link' });
      return;
    }
    const { title, body } = splitCapture(text);
    const note = makeNote(museumId, { title, body });
    await upsert('notes', note);
    setKept({ id: note.id, type: 'notes', text, as: 'note' });
  }, [museumId, upsert]);

  /** The one optional follow-up: turn what was just kept into something else. */
  const reclassify = useCallback(async (as: CaptureAs) => {
    if (!kept) return;
    const text = kept.text;
    const { title, body } = splitCapture(text);
    if (as === 'project') {
      const p = await ops.createProject({ title, summary: body, goalIds: goal ? [goal.id] : [] });
      await remove(kept.type, kept.id);
      setKept({ id: p.id, type: 'projects', text, as: 'project' });
      say(goal ? `A project now, serving “${goal.title}”.` : 'A project now.');
      return;
    }
    if (as === 'link') {
      const item = makeLink(museumId, { url: text.split(/\s+/)[0] ?? text, whySaved: '' });
      await upsert('links', item);
      await remove(kept.type, kept.id);
      setKept({ id: item.id, type: 'links', text, as: 'link' });
      return;
    }
    if (kept.type === 'notes') {
      const note = records.notes.find((n) => n.id === kept.id);
      if (note) await upsert('notes', touched(note, as === 'idea' ? { kind: 'idea' } : { kind: 'note' }));
      setKept({ ...kept, as });
      return;
    }
    const note = makeNote(museumId, { title, body, ...(as === 'idea' ? { kind: 'idea' as const } : {}) });
    await upsert('notes', note);
    await remove(kept.type, kept.id);
    setKept({ id: note.id, type: 'notes', text, as });
  }, [kept, goal, museumId, ops, records.notes, remove, upsert, say]);

  /**
   * Adding a step never requires understanding projects. If the goal has none,
   * one is created quietly to hold the step; the visitor only ever types the
   * step itself. The data model is unchanged, only the vocabulary is.
   */
  const addStep = async () => {
    const text = newStep.trim();
    if (!text || !goal) return;
    const holder = needsStep[0] ?? await ops.createProject({ title: goal.title, summary: '', goalIds: [goal.id] });
    await ops.addAction(holder.id, text);
    setNewStep('');
  };

  const hideForgotten = async () => {
    if (!forgotten) return;
    await upsert(typeOfCuriosity(forgotten.kind), { ...forgotten.item, restUntil: now + 60 * DAY } as never);
    say('Put away for a while. Nothing else about it changed.', undefined, { quiet: true });
  };
  const keepForgotten = async () => {
    if (!forgotten) return;
    await upsert(typeOfCuriosity(forgotten.kind), { ...forgotten.item, lastVisitedAt: now } as never);
    setSkipped((s) => new Set([...s, forgotten.id]));
    say('Good. It counts as seen.', undefined, { quiet: true });
  };
  const forgottenIntoStep = async () => {
    if (!forgotten) return;
    if (forgotten.kind === 'project') {
      await ops.setProjectStatus(forgotten.item as never, 'active');
      return;
    }
    const target = step?.project.id ?? records.projects.find((p) => p.status === 'active')?.id;
    if (!target) { say('Add a project first, then this can become a step in it.', undefined, { quiet: true }); return; }
    await ops.addAction(target, forgotten.title);
    await upsert(typeOfCuriosity(forgotten.kind), { ...forgotten.item, lastVisitedAt: now } as never);
    setSkipped((s) => new Set([...s, forgotten.id]));
  };

  if (!loadedPin) return <div className="booting" aria-busy="true"><span className="plaque">Opening</span></div>;

  const firstName = active?.visitorName?.split(/\s+/)[0];

  return (
    <div className="today">
      <StarField className="today__sky" seed={`today:${museumId}`} density={0.35} />
      <div className="today__glow" aria-hidden="true" />

      <div className="today__inner">
        <header className="today__head">
          <span className="plaque">{timeOfDayGreeting()}{firstName ? `, ${firstName}` : ''}</span>
          <h1 className="today__title">Today</h1>
        </header>

        {/* 1 — What matters most right now? */}
        <section className="card card--focus" aria-labelledby="t-focus">
          <span className="plaque" id="t-focus">What matters most</span>
          {goal ? (
            <>
              <h2 className="card__headline">{goal.title}</h2>
              {goal.why && <p className="card__why">{goal.why}</p>}
              <div className="card__foot">
                {progress && progress.total > 0 && (
                  <span className="plaque tabular">{progress.done} of {progress.total} steps done · {progress.projects} project{progress.projects === 1 ? '' : 's'}</span>
                )}
                <button type="button" className="linky" onClick={() => setChoosing((v) => !v)} aria-expanded={choosing}>
                  {choosing ? 'Never mind' : 'Focus on something else'}
                </button>
              </div>
              {choosing && (
                <ul className="choices">
                  {focus.choices.map((g) => (
                    <li key={g.id}>
                      <button type="button" className={`choice ${g.id === goal.id ? 'is-current' : ''}`} onClick={() => void pick(g)}>
                        <span className="choice__title display">{g.title}</span>
                        <span className="plaque">{g.state === 'dormant' ? 'resting' : 'in the sky'}</span>
                      </button>
                    </li>
                  ))}
                  <li><RouterLink to="/library?new=goal" className="choice choice--add">Name a new goal</RouterLink></li>
                </ul>
              )}
            </>
          ) : (
            <>
              <h2 className="card__headline card__headline--invite">Name one thing you are steering by.</h2>
              <p className="card__why">A goal is a direction, not a task. Everything else on this screen follows from it.</p>
              <NewGoal onCreate={async (title) => { const g = await ops.createGoal({ title, why: '', horizon: 'year' }); await pick(g); }} />
            </>
          )}
        </section>

        {/* 2 — What is the next small thing? */}
        {goal && (
          <section className="card" aria-labelledby="t-step">
            <span className="plaque" id="t-step">The next small thing</span>
            {step ? (
              <>
                <h2 className="card__headline card__headline--step">{step.action.text}</h2>
                <p className="card__why">for {step.project.title}</p>
                <div className="card__actions">
                  <Instrument tone="primary" onClick={() => void ops.toggleAction(step.action)}>Done</Instrument>
                  <Instrument onClick={() => void upsert('actions', touched(step.action, { restUntil: now + DAY }))}>Not today</Instrument>
                  {step.alternatives.length > 0 && (
                    <button type="button" className="linky" onClick={() => setPickingStep((v) => !v)} aria-expanded={pickingStep}>
                      {pickingStep ? 'Never mind' : `Choose another (${step.alternatives.length})`}
                    </button>
                  )}
                </div>
                {pickingStep && (
                  <ul className="choices">
                    {step.alternatives.map(({ action, project }) => (
                      <li key={action.id}>
                        <button type="button" className="choice" onClick={() => { void upsert('actions', touched(step.action, { restUntil: now + DAY })); void upsert('actions', touched(action, {})); setPickingStep(false); }}>
                          <span className="choice__title">{action.text}</span>
                          <span className="plaque">{project.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <>
                <h2 className="card__headline card__headline--invite">Nothing is named yet.</h2>
                <p className="card__why">
                  {needsStep.length > 0
                    ? `“${needsStep[0]!.title}” is waiting for its next step. The smaller the better.`
                    : 'What is one small thing that would move this forward? The smaller the better.'}
                </p>
                <form className="inline-form" onSubmit={(e) => { e.preventDefault(); void addStep(); }}>
                  <input value={newStep} onChange={(e) => setNewStep(e.target.value)} placeholder="The smallest next step" aria-label="The smallest next step" maxLength={200} />
                  <Instrument tone="primary" type="submit" disabled={!newStep.trim()}>Add</Instrument>
                </form>
              </>
            )}
          </section>
        )}

        {/* 3 — What do I want to capture? */}
        <section className="card" aria-labelledby="t-capture">
          <span className="plaque" id="t-capture">Anything to keep?</span>
          <Capture onCapture={capture} onReclassify={reclassify} saved={kept ? { text: kept.text, as: kept.as } : null} onDismissSaved={() => setKept(null)} />
        </section>

        {/* 4 — What have I forgotten? */}
        {forgotten && (
          <section className="card card--quiet" aria-labelledby="t-forgotten">
            <span className="plaque" id="t-forgotten">You may have forgotten</span>
            <h2 className="card__headline card__headline--small">{forgotten.title}</h2>
            <p className="card__why">{forgotten.reasons[0]}</p>
            <div className="card__actions">
              <Instrument onClick={() => void keepForgotten()}>Still matters</Instrument>
              <Instrument onClick={() => void forgottenIntoStep()}>{forgotten.kind === 'project' ? 'Set it in motion' : 'Make it a step'}</Instrument>
              <Instrument tone="quiet" onClick={() => void hideForgotten()}>Hide for now</Instrument>
              <button type="button" className="linky" onClick={() => setSkipped((s) => new Set([...s, forgotten.id]))}>Something else</button>
            </div>
          </section>
        )}

        <footer className="today__foot">
          <RouterLink to="/observatory" className="today__bigger">See the bigger picture →</RouterLink>
          <span className="today__foot-note plaque">Everything stays in this browser{active ? ` · ${active.name}` : ''}</span>
        </footer>
      </div>
    </div>
  );
}

function NewGoal({ onCreate }: { onCreate: (title: string) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form className="inline-form" onSubmit={async (e) => { e.preventDefault(); if (!title.trim() || busy) return; setBusy(true); try { await onCreate(title.trim()); } finally { setBusy(false); } }}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What are you steering by?" aria-label="Your first goal" maxLength={120} autoFocus />
      <Instrument tone="primary" type="submit" disabled={busy || !title.trim()}>Set it</Instrument>
    </form>
  );
}

function typeOfCuriosity(kind: string): RecordType {
  if (kind === 'project') return 'projects';
  if (kind === 'link') return 'links';
  if (kind === 'memory') return 'memories';
  return 'notes';
}

export { relativeAge };

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMuseumStore } from '@/store/museum';
import { useMuseumOps } from '@/store/ops';
import { useUiStore } from '@/store/ui';
import { useSettingsStore } from '@/store/settings';
import { motionReduced } from '@/lib/motion';
import { disableDomeForSession, domeDisabledBySession, lowPowerDevice, webglAvailable } from '@/lib/webgl';
import type { Goal } from '@/types';
import { GoalForm } from './GoalForm';
import { GoalPanel } from './GoalPanel';
import { SkyCanvas } from './SkyCanvas';
import { SkyIndex } from './SkyIndex';
import { isInSky, layoutSky, nextForGoal } from './layout';
import './observatory.css';

const Sky3D = lazy(() => import('./Sky3D'));

function domeWanted(): boolean {
  return webglAvailable() && !motionReduced() && !lowPowerDevice() && !domeDisabledBySession();
}

export default function Observatory() {
  const records = useMuseumStore((s) => s.records);
  const upsert = useMuseumStore((s) => s.upsert);
  const say = useUiStore((s) => s.say);
  const ops = useMuseumOps();
  const { goals, projects, actions } = records;
  const [params] = useSearchParams();

  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(() => params.get('goal'));
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [canvasOk, setCanvasOk] = useState(true);
  const [dome, setDome] = useState<boolean>(() => domeWanted());
  const [domeReady, setDomeReady] = useState(false);
  const [litGoalId, setLitGoalId] = useState<string | null>(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5 });
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);

  // The keeper's motion setting can switch the dome on or off while the room is open.
  useEffect(() => {
    const wanted = domeWanted();
    setDome(wanted);
    if (!wanted) setDomeReady(false);
  }, [reduceMotion]);

  const dropDome = useCallback((reason: 'perf' | 'lost') => {
    disableDomeForSession();
    setDome(false);
    setDomeReady(false);
    if (reason === 'perf') say('The sky is drawn flat here, to keep the room quick.');
  }, [say]);

  const layout = useMemo(() => layoutSky(goals, projects), [goals, projects]);
  const selectedGoal = goals.find((g) => g.id === selectedGoalId) ?? null;
  const skyGoals = goals.filter(isInSky);

  // The emphasised "next": for the selected goal, or for the freshest goal in the sky.
  const focusGoal = selectedGoal ?? [...skyGoals].sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
  const next = focusGoal ? nextForGoal(focusGoal.id, projects, actions) : null;

  // Visiting a goal marks it visited (for the Cabinet later).
  useEffect(() => {
    if (!selectedGoal) return;
    if (Date.now() - selectedGoal.lastVisitedAt < 60_000) return;
    void upsert('goals', { ...selectedGoal, lastVisitedAt: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGoalId]);

  const selectProject = useCallback((id: string) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    const goalId = p.goalIds.find((g) => skyGoals.some((sg) => sg.id === g)) ?? null;
    setSelectedGoalId(goalId);
    setExpandedProjectId(id);
  }, [projects, skyGoals]);

  const createGoal = async (v: { title: string; why: string; horizon: Goal['horizon'] }) => {
    const g = await ops.createGoal(v);
    setSelectedGoalId(g.id);
    say('A new constellation. Give it a project to orbit.');
  };

  const empty = goals.length === 0;

  return (
    <section className={`obs ${empty ? 'obs--empty' : ''}`}>
      <h1 className="visually-hidden">Observatory</h1>
      <div className="obs__sky">
        {canvasOk && dome && !empty && (
          <Suspense fallback={null}>
            <Sky3D
              layout={layout}
              goals={goals}
              projects={projects}
              litGoalId={litGoalId}
              selectedGoalId={selectedGoalId}
              pointerRef={pointerRef}
              onReady={() => setDomeReady(true)}
              onPoorPerformance={() => dropDome('perf')}
              onContextLost={() => dropDome('lost')}
            />
          </Suspense>
        )}
        {canvasOk ? (
          <SkyCanvas
            mode={dome && domeReady && !empty ? 'overlay' : 'full'}
            pointerRef={pointerRef}
            onActiveGoal={setLitGoalId}
            layout={layout}
            goals={goals}
            projects={projects}
            actions={actions}
            selectedGoalId={selectedGoalId}
            emphasisProjectId={next?.project.id ?? null}
            onSelectGoal={(id) => { setSelectedGoalId(id); if (!id) setExpandedProjectId(null); }}
            onSelectProject={selectProject}
            onUnsupported={() => setCanvasOk(false)}
          />
        ) : (
          <div className="obs__nosky">
            <span className="plaque">The dome is shuttered</span>
            <p>This browser cannot draw the sky. Everything is still here in the list.</p>
          </div>
        )}

        {empty && (
          <div className="obs__invite">
            <span className="plaque">The sky is dark</span>
            <h1 className="obs__invite-title">Name the first thing you are steering by.</h1>
            <p className="obs__invite-lede">A goal is a direction, not a task. It becomes a constellation here, and the projects that serve it will orbit it.</p>
            <GoalForm onSubmit={createGoal} submitLabel="Set it in the sky" />
          </div>
        )}

        {!empty && (
          <div className="obs__caption" aria-hidden={!focusGoal}>
            {focusGoal && next ? (
              <>
                <span className="plaque">Next · {focusGoal.title}</span>
                <p className="obs__caption-text display">{next.action.text}</p>
              </>
            ) : focusGoal ? (
              <>
                <span className="plaque">{focusGoal.title}</span>
                <p className="obs__caption-text display obs__caption-text--dim">No next step is lit.</p>
              </>
            ) : null}
          </div>
        )}

        {!empty && (
          <ul className="obs__legend" aria-label="Legend">
            <li><span className="legend__goal" /> goal</li>
            <li><span className="legend__project" /> project</li>
            <li><span className="legend__next" /> next action</li>
            <li><span className="legend__done" /> finished</li>
          </ul>
        )}
      </div>

      <aside className="obs__panel">
        {selectedGoal ? (
          <GoalPanel
            goal={selectedGoal}
            goals={goals}
            projects={projects}
            actions={actions}
            expandedProjectId={expandedProjectId}
            onExpandProject={setExpandedProjectId}
            onBack={() => { setSelectedGoalId(null); setExpandedProjectId(null); }}
            ops={ops}
          />
        ) : empty ? (
          <div className="panel">
            <header className="panel__head">
              <span className="plaque">How this room works</span>
              <h2 className="panel__title">Goals, projects, next steps</h2>
            </header>
            <ol className="guide">
              <li><strong>A goal</strong> is a direction you are steering by. It becomes a constellation.</li>
              <li><strong>A project</strong> is bounded work that serves a goal. It orbits the goal as a smaller star.</li>
              <li><strong>A next action</strong> is the one physical step a project needs now. The brightest point in the sky is always the next thing to do.</li>
            </ol>
            <p className="panel__empty">Nothing here leaves your browser. Export a backup from the keeper's desk whenever you like.</p>
          </div>
        ) : (
          <SkyIndex
            goals={goals}
            projects={projects}
            actions={actions}
            onSelect={setSelectedGoalId}
            onCreateGoal={createGoal}
            expandedProjectId={expandedProjectId}
            onExpandProject={setExpandedProjectId}
            ops={ops}
          />
        )}
      </aside>
    </section>
  );
}

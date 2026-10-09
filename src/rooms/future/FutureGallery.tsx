import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Instrument } from '@/components/Instrument';
import { RangeField, SelectField, TextField } from '@/components/Field';
import { makeScenario, touched } from '@/data/factories';
import { relativeAge } from '@/lib/dates';
import { useMuseumStore } from '@/store/museum';
import { useUiStore } from '@/store/ui';
import type { Scenario } from '@/types';
import { Timeline } from './Timeline';
import { SIZE_OPTIONS, assumptionsText, clampControls, explain, simulate, type Controls } from './model';
import './future.css';

const DEFAULT: Controls = { hoursPerWeek: 3, consistency: 0.6, focus: 0.7, rest: 0.6, projectHours: 40 };

export default function FutureGallery() {
  const museumId = useMuseumStore((s) => s.activeMuseumId)!;
  const records = useMuseumStore((s) => s.records);
  const upsert = useMuseumStore((s) => s.upsert);
  const remove = useMuseumStore((s) => s.remove);
  const say = useUiStore((s) => s.say);
  const { goals, projects, actions, scenarios } = records;

  const inSky = goals.filter((g) => g.state === 'active' || g.state === 'dormant').sort((a, b) => b.updatedAt - a.updatedAt);
  const [goalId, setGoalId] = useState<string>(() => inSky[0]?.id ?? '');
  const [controls, setControls] = useState<Controls>(DEFAULT);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [dirty, setDirty] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);

  useEffect(() => { if (!goalId && inSky[0]) setGoalId(inSky[0].id); }, [inSky, goalId]);
  const goal = goals.find((g) => g.id === goalId) ?? null;
  const outlook = useMemo(() => (goal ? simulate(goal, projects, actions, controls) : null), [goal, projects, actions, controls]);
  const lines = useMemo(() => (goal && outlook ? explain(outlook, goal) : []), [goal, outlook]);
  const saved = scenarios.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const loaded = saved.find((s) => s.id === loadedId) ?? null;

  const set = (patch: Partial<Controls>) => { setControls((c) => clampControls({ ...c, ...patch })); setDirty(true); };
  const load = (s: Scenario) => {
    setGoalId(goals.some((g) => g.id === s.goalId) ? s.goalId : (inSky[0]?.id ?? ''));
    setControls(clampControls({ hoursPerWeek: s.hoursPerWeek, consistency: s.consistency, focus: s.focus, rest: s.rest, projectHours: s.projectHours ?? 40 }));
    setLoadedId(s.id);
    setName(s.name);
    setDirty(false);
  };
  const keep = async () => {
    if (!goal) return;
    if (loaded) {
      await upsert('scenarios', touched(loaded, { name: name.trim() || loaded.name, goalId: goal.id, hoursPerWeek: controls.hoursPerWeek, consistency: controls.consistency, focus: controls.focus, rest: controls.rest, projectHours: controls.projectHours ?? 40 }));
      say('The what-if is kept, as edited.');
    } else {
      const s = makeScenario(museumId, { name, goalId: goal.id, hoursPerWeek: controls.hoursPerWeek, consistency: controls.consistency, focus: controls.focus, rest: controls.rest, projectHours: controls.projectHours ?? 40 });
      await upsert('scenarios', s);
      setLoadedId(s.id);
      setName(s.name);
      say('Kept. It is only ever a way of looking.');
    }
    setDirty(false);
  };
  const drop = async (s: Scenario) => {
    await remove('scenarios', s.id);
    if (loadedId === s.id) { setLoadedId(null); setName(''); }
    say('Let go.');
  };
  const fresh = () => { setLoadedId(null); setName(''); setControls(DEFAULT); setDirty(false); };

  const noGoals = inSky.length === 0;

  return (
    <section className={`fg ${noGoals ? 'fg--empty' : ''}`}>
      <div className="fg__hall">
        <header className="fg__head">
          <span className="plaque">A model, not a prophecy</span>
          <h1 className="fg__title">Future Gallery</h1>
          <p className="fg__intent">Turn a few dials and watch a goal's next year rearrange. This is a “what if?”, drawn from your own projects with rules you can read. It does not know what will happen. Nobody does.</p>
        </header>

        {noGoals ? (
          <div className="fg__invite">
            <span className="plaque">Nothing to imagine yet</span>
            <h2 className="fg__invite-title">The gallery needs a goal to look at.</h2>
            <p className="fg__invite-lede">Name one in the Observatory, give it a project or two in the Workshop, and come back to see how different weeks would move it.</p>
            <div className="form-actions">
              <RouterLink to="/observatory" className="instrument instrument--primary">Go to the Observatory</RouterLink>
            </div>
          </div>
        ) : goal && outlook && (
          <>
            <div className="fg__controls">
              <SelectField label="Looking at" value={goalId} onChange={(e) => { setGoalId(e.target.value); setDirty(true); }}>
                {inSky.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </SelectField>
              <RangeField label="Hours a week" unit=" h" min={0} max={20} step={1} value={controls.hoursPerWeek} onChange={(e) => set({ hoursPerWeek: Number(e.target.value) })} hint={hoursHint(controls.hoursPerWeek)} />
              <RangeField label="Consistency" min={0} max={100} step={5} value={Math.round(controls.consistency * 100)} onChange={(e) => set({ consistency: Number(e.target.value) / 100 })} hint={consistencyHint(controls.consistency)} />
              <RangeField label="Focus" min={0} max={100} step={5} value={Math.round(controls.focus * 100)} onChange={(e) => set({ focus: Number(e.target.value) / 100 })} hint={focusHint(controls.focus, outlook.workedCount, outlook.candidateCount)} />
              <RangeField label="Rest and recovery" min={0} max={100} step={5} value={Math.round(controls.rest * 100)} onChange={(e) => set({ rest: Number(e.target.value) / 100 })} hint={restHint(controls.rest)} />
              <SelectField label="Typical project size" value={String(controls.projectHours ?? 40)} onChange={(e) => set({ projectHours: Number(e.target.value) })} hint="A rough guess used for any project without its own size. Set a size per project in the Workshop.">
                {SIZE_OPTIONS.map((o) => <option key={o.hours} value={o.hours}>{o.label} · {o.hint}</option>)}
              </SelectField>
            </div>

            <div className="fg__frame">
              <Timeline outlook={outlook} goalTitle={goal.title} />
            </div>

            <div className="fg__reading">
              <span className="plaque">What this way of looking shows</span>
              {lines.map((l, i) => <p key={i} className="fg__line">{l}</p>)}
              <button type="button" className="fg__assume plaque" onClick={() => setShowAssumptions((v) => !v)} aria-expanded={showAssumptions}>
                {showAssumptions ? 'Hide the assumptions' : 'Show the assumptions behind this'}
              </button>
              {showAssumptions && (
                <ul className="fg__assumptions">{assumptionsText(controls).map((a, i) => <li key={i}>{a}</li>)}</ul>
              )}
              {outlook.candidateCount === 0 && (
                <p className="panel__empty">Give this goal a project in the <RouterLink to="/workshop">Workshop</RouterLink> and the dials will have something to move.</p>
              )}
            </div>
          </>
        )}
      </div>

      <aside className="fg__panel">
        <div className="panel">
          <header className="panel__head">
            <span className="plaque">Kept what-ifs · {saved.length}</span>
            <h2 className="panel__title">{loaded ? 'This what-if' : 'Keep this way of looking'}</h2>
            <p className="panel__why">A kept scenario is just its dials and a name. Nothing here changes your goals or projects.</p>
          </header>

          {!noGoals && (
            <form className="goal-form" onSubmit={(e) => { e.preventDefault(); void keep(); }}>
              <TextField label="Name" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} placeholder="Two evenings a week, most weeks" maxLength={80} />
              <div className="form-actions">
                <Instrument tone="primary" type="submit" disabled={!goal || (loaded !== null && !dirty)}>{loaded ? 'Save changes' : 'Keep this what-if'}</Instrument>
                {loaded && <Instrument tone="quiet" type="button" onClick={fresh}>Start a new one</Instrument>}
              </div>
            </form>
          )}

          {saved.length > 0 && (
            <ul className="index">
              {saved.map((s) => {
                const g = goals.find((x) => x.id === s.goalId);
                return (
                  <li key={s.id} className="fg-saved">
                    <button type="button" className={`index__item ${loadedId === s.id ? 'is-loaded' : ''}`} onClick={() => load(s)} aria-pressed={loadedId === s.id}>
                      <span className="index__text">
                        <span className="index__title display">{s.name}</span>
                        <span className="plaque">{g ? g.title : 'a goal that is gone'} · {s.hoursPerWeek}h/wk · {Math.round(s.consistency * 100)}% steady</span>
                        <span className="index__next">kept {relativeAge(s.updatedAt)}</span>
                      </span>
                    </button>
                    <button type="button" className="fg-saved__remove" aria-label={`Let go of ${s.name}`} onClick={() => void drop(s)}>×</button>
                  </li>
                );
              })}
            </ul>
          )}
          {saved.length === 0 && !noGoals && <p className="panel__empty">Nothing kept yet. Set the dials, name it, keep it, and come back to it later.</p>}
        </div>
      </aside>
    </section>
  );
}

function hoursHint(h: number) { return h === 0 ? 'No time at all. See what stands still.' : h <= 2 ? 'A slice of one evening.' : h <= 5 ? 'A couple of evenings, or a weekend morning.' : h <= 10 ? 'A serious weekly commitment.' : 'A second job’s worth. Be honest about it.'; }
function consistencyHint(c: number) { return c < 0.3 ? 'Most weeks slip. Restarting is the real cost.' : c < 0.6 ? 'About half the weeks happen.' : c < 0.85 ? 'Most weeks happen. Missing some is fine.' : 'Nearly every week. The rare kind.'; }
function focusHint(f: number, worked: number, total: number) { return total <= 1 ? 'Only one project serves this goal, so focus does not split.' : f >= 0.85 ? `One main project at a time (1 of ${total}).` : f >= 0.4 ? `A few at once (${worked} of ${total}).` : `Everything at once (${worked} of ${total}). More moves; each moves less.`; }
function restHint(r: number) { return r < 0.3 ? 'Running on fumes. The pace fades by winter.' : r < 0.5 ? 'Tight. It holds, then slips.' : r < 0.75 ? 'Enough to keep going all year.' : 'Protected. Rested weeks compound a little.'; }

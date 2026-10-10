import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StarField } from '@/components/StarField';
import { motionReduced } from '@/lib/motion';
import { observeSurface } from '@/lib/surface';
import { webglAvailable } from '@/lib/webgl';
import { buildDemoSnapshot, DEMO_MIND_ID } from '@/mind/demo';
import { useMind } from '@/mind/store';
import { SkyEngine, type MoteTarget, type SkyView } from '@/sky/engine';
import { buildSkyModel } from '@/sky/model';
import '@/components/Field.css';
import '@/components/Instrument.css';
import '@/sky/sky3d.css';
import './tour.css';

interface Chapter { id: string; view: SkyView; eyebrow: string; title: string; body: string[]; mote?: MoteTarget; list?: string[]; quote?: string }

const CHAPTERS: Chapter[] = [
  { id: 'mind', view: { level: 'mind' }, eyebrow: 'A museum for your mind', title: 'This is a mind', body: ['Alex is a made-up person with a full-time job, slowly making room for the things that matter.', 'Each area of Alex’s life is a galaxy: Health, a side project, Creativity, People. You can have as many as you like.'] },
  { id: 'arrive', view: { level: 'galaxy', galaxyId: 'd-gx-app' }, eyebrow: 'Capture', title: 'A thought arrives', body: ['On the bus, Alex thinks: “A weekly email that shows where the money went.”', 'One tap on the gold button, a few words, Save. No decisions yet.'], mote: { kind: 'galaxy', id: 'd-gx-app' } },
  { id: 'drift', view: { level: 'galaxy', galaxyId: 'd-gx-app' }, eyebrow: 'Unsorted', title: 'It waits until you are ready', body: ['Thoughts without a home drift in their galaxy as a soft cloud. Nothing is lost there, and nothing nags.', 'When your head is full, Clear my mind takes everything at once, one thought per line.'] },
  { id: 'home', view: { level: 'system', galaxyId: 'd-gx-app', goalId: 'd-g-app' }, eyebrow: 'Sorting, when calm', title: 'You give it a home', body: ['Later, each thought gets a home: a goal, a project, or simply a galaxy. A thought linked to a goal circles it like a moon.', 'The museum even suggests a likely home, by the words you used. It never decides for you.'] },
  { id: 'stars', view: { level: 'system', galaxyId: 'd-gx-app', goalId: 'd-g-app' }, eyebrow: 'Goals and projects', title: 'Goals are stars, projects are planets', body: ['A goal is a direction you could follow for years: “Ship my budget app”, and one line on why it matters.', 'Projects are planets around it: things you can finish or keep up. Steps live on a project’s page, never in the sky.'] },
  { id: 'shapes', view: { level: 'project', galaxyId: 'd-gx-app', goalId: 'd-g-app', projectId: 'd-p-users' }, eyebrow: 'Six shapes', title: 'Every project has a shape', body: ['“Ten people try it” is a number to reach. Each person who tries the app adds one, and the ring of light closes.'], list: ['A list to finish', 'A number to reach', 'A habit to keep', 'Getting ready for a day', 'A climb in levels', 'A question to explore'] },
  { id: 'questions', view: { level: 'system', galaxyId: 'd-gx-health', goalId: 'd-g-strong' }, eyebrow: 'When it feels foggy', title: 'Questions flicker until you answer them', body: ['“Is the gym worth it, or is running enough?” An open question flickers in the sky until Alex writes an answer, even a rough one.', 'Seeing what you are actually unsure about is often half the answer.'] },
  { id: 'today', view: { level: 'rest' }, eyebrow: 'Today', title: 'Today stays small', body: ['Each day: one thought to sit with, then at most two goals with one step each.', 'No streaks, no red numbers, nothing overdue. A missed day simply waits.'] },
  { id: 'journal', view: { level: 'rest' }, eyebrow: 'Journal', title: 'The journal remembers', body: ['What happened and how it felt, kept apart from goals. A month later, “On this day” brings it back.'], quote: 'Photo walk by the canal. Low light, lovely colours. Two photos I actually like.' },
  { id: 'week', view: { level: 'mind' }, eyebrow: 'Sunday', title: 'Two quiet minutes, once a week', body: ['What moved, what went quiet, and one or two goals to focus on next. Worked out on your device; no AI needed.', 'Everything stays in this browser. A backup file moves it to your other devices.'] },
];

/** The guided tour: one scroll through Alex's museum, with the sky acting out each chapter. */
export default function Tour() {
  const navigate = useNavigate();
  const minds = useMind((s) => s.minds);
  const enter = useMind((s) => s.enter);
  const createMind = useMind((s) => s.createMind);
  const own = minds.filter((m) => m.kind === 'own');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SkyEngine | null>(null);
  const [live, setLive] = useState(() => webglAvailable());
  const [active, setActive] = useState(0);
  const [name, setName] = useState('');
  const [keeper, setKeeper] = useState('');
  const [galaxy, setGalaxy] = useState('Personal');
  const [busy, setBusy] = useState(false);
  const model = useMemo(() => buildSkyModel(buildDemoSnapshot()), []);
  const markTourSeen = useMind((s) => s.markTourSeen);
  useEffect(() => { void markTourSeen(); }, [markTourSeen]);
  // Arriving with #begin (from "Make my own") goes straight to the form.
  useEffect(() => {
    if (location.hash !== '#begin') return;
    const t = window.setTimeout(() => document.getElementById('begin')?.scrollIntoView({ block: 'start' }), 150);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current, layer = layerRef.current;
    if (!live || !canvas || !layer) return;
    let engine: SkyEngine;
    try { engine = new SkyEngine(canvas, layer, { select: () => undefined, zoomOut: () => undefined }, motionReduced()); } catch { setLive(false); return; }
    engineRef.current = engine;
    engine.setModel(model);
    engine.setView(CHAPTERS[0]!.view);
    const stop = observeSurface(canvas, (s) => { engine.resize(s); engine.setBias(s.width >= 700 ? -0.2 : 0, s.width >= 700 ? 0 : 0.2); });
    engine.arrive();
    return () => { stop(); engine.dispose(); engineRef.current = null; };
  }, [live, model]);

  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>('[data-chapter]')];
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.chapter));
    }, { rootMargin: '-45% 0px -45% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const shown = useRef(new Set<number>());
  useEffect(() => {
    const c = CHAPTERS[active] ?? CHAPTERS[CHAPTERS.length - 1]!;
    const engine = engineRef.current;
    if (!engine) return;
    engine.setView(c.view);
    if (c.mote && !shown.current.has(active)) {
      shown.current.add(active);
      const el = document.querySelector<HTMLElement>(`[data-chapter="${active}"] .tour__card`);
      const r = el?.getBoundingClientRect();
      if (r) window.setTimeout(() => engine.launchMote(r.left + r.width / 2, r.top + 40, c.mote!), 900);
    }
  }, [active]);

  const begin = async () => {
    setBusy(true);
    try { await createMind({ name: name || (keeper ? `${keeper}'s mind` : 'My Mind'), visitorName: keeper, galaxyName: galaxy }); navigate('/'); } finally { setBusy(false); }
  };
  const wander = async () => { setBusy(true); try { await enter(DEMO_MIND_ID); navigate('/'); } finally { setBusy(false); } };

  return (
    <div className="tour">
      <div className="tour__sky" aria-hidden="true">
        {live ? <><canvas ref={canvasRef} className="skystage__canvas tour__canvas" /><div ref={layerRef} className="skystage__labels tour__labels" /></> : <StarField seed="tour" density={1.2} />}
      </div>
      <header className="tour__top">
        <span className="tour__brand">The Museum of My Mind</span>
        {own.length > 0 && <button type="button" className="tour__skip" onClick={() => navigate('/welcome')}>Skip the tour</button>}
        {own.length === 0 && <a href="#begin" className="tour__skip">Skip to the start</a>}
      </header>
      <main className="tour__chapters">
        <section className="tour__hero" data-chapter={0}>
          <div className="tour__card tour__card--hero">
            <p className="tour__over">The Museum of</p>
            <h1 className="tour__title">My <em>Mind</em></h1>
            <p className="tour__lede">A quiet place to see your thoughts, sort them, and find your way when life feels crowded. Scroll once to see how it works, using Alex’s museum.</p>
            <p className="tour__hint" aria-hidden="true">Scroll</p>
          </div>
        </section>
        {CHAPTERS.slice(1).map((c, i) => (
          <section key={c.id} className="tour__chapter" data-chapter={i + 1}>
            <article className={`tour__card plate ${active === i + 1 ? 'tour__card--on' : ''}`}>
              <p className="place__eyebrow"><span className="tour__num">{i + 1}</span> {c.eyebrow}</p>
              <h2 className="tour__h2">{c.title}</h2>
              {c.body.map((b) => <p key={b} className="tour__p">{b}</p>)}
              {c.list && <ul className="tour__list">{c.list.map((x) => <li key={x}>{x}</li>)}</ul>}
              {c.quote && <blockquote className="tour__quote">“{c.quote}”</blockquote>}
            </article>
          </section>
        ))}
        <section id="begin" className="tour__chapter tour__chapter--begin" data-chapter={CHAPTERS.length}>
          <div className="tour__card plate tour__begin">
            <p className="place__eyebrow">Begin</p>
            <h2 className="tour__h2">Your own museum</h2>
            <form className="tour__form" onSubmit={(e) => { e.preventDefault(); void begin(); }}>
              <label className="field"><span className="plaque">Your name (optional)</span><input className="field__input" value={keeper} onChange={(e) => setKeeper(e.target.value)} autoComplete="given-name" /></label>
              <label className="field"><span className="plaque">Name your museum</span><input className="field__input" value={name} onChange={(e) => setName(e.target.value)} placeholder={keeper ? `${keeper}'s mind` : 'My Mind'} /></label>
              <label className="field"><span className="plaque">Your first galaxy</span><input className="field__input" value={galaxy} onChange={(e) => setGalaxy(e.target.value)} /></label>
              <div className="form-actions">
                <button type="submit" className="instrument instrument--primary" disabled={busy}>Open my museum</button>
                <button type="button" className="instrument" onClick={() => void wander()} disabled={busy}>Wander Alex’s museum first</button>
              </div>
              <p className="meta">Everything stays in this browser. No account, nothing to install. The tour and Alex’s museum are always in Settings.</p>
              <button type="button" className="linkish" onClick={() => navigate('/join')}>Already have a museum on another device? Join it</button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

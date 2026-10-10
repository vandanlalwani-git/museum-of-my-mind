import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motionReduced } from '@/lib/motion';
import { observeSurface } from '@/lib/surface';
import { useMind } from '@/mind/store';
import { SkyEngine, type SkyTarget } from './engine';
import { buildSkyModel } from './model';
import { parentRoute, viewForRoute } from './route';
import { useSky } from './store';
import './sky3d.css';

const ARRIVED = 'museum:arrived';

/** The living sky behind every place. Lazy-loaded; the rest of the museum never waits for it. */
export default function SkyStage({ onFail }: { onFail: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SkyEngine | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const snap = useMind((s) => s.snap);
  const mode = useSky((s) => s.mode);
  const setLive = useSky((s) => s.setLive);
  const setPeek = useSky((s) => s.setPeek);
  const setLaunch = useSky((s) => s.setLaunch);
  const routeRef = useRef({ pathname: location.pathname, search: location.search });
  routeRef.current = { pathname: location.pathname, search: location.search };
  // The router hands out a new navigate function on every route change; the engine must outlive those.
  const navRef = useRef(navigate);
  navRef.current = navigate;

  useEffect(() => {
    const canvas = canvasRef.current, layer = layerRef.current;
    if (!canvas || !layer) return;
    let engine: SkyEngine;
    const select = (t: SkyTarget) => {
      setPeek(null);
      switch (t.kind) {
        case 'galaxy': navRef.current(`/?galaxy=${t.id}`); break;
        case 'goal': navRef.current(`/?goal=${t.id}`); break;
        case 'open-goal': navRef.current(`/goal/${t.id}`); break;
        case 'project': navRef.current(`/project/${t.id}`); break;
        case 'thought': setPeek({ kind: 'thought', id: t.id }); break;
        case 'question': setPeek({ kind: 'question', id: t.id }); break;
        case 'unsorted': navRef.current('/unsorted'); break;
        case 'new-galaxy': setPeek({ kind: 'new-galaxy' }); break;
      }
    };
    const zoomOut = () => {
      const { pathname, search } = routeRef.current;
      const to = parentRoute(pathname, search, useMind.getState().snap);
      if (to) navRef.current(to);
    };
    try {
      engine = new SkyEngine(canvas, layer, { select, zoomOut }, motionReduced());
    } catch {
      onFail();
      return;
    }
    engineRef.current = engine;
    const snapNow = useMind.getState().snap;
    if (snapNow) engine.setModel(buildSkyModel(snapNow));
    engine.setView(viewForRoute(routeRef.current.pathname, routeRef.current.search, snapNow, useSky.getState().mode));
    if (import.meta.env.DEV) (window as unknown as { __sky?: SkyEngine }).__sky = engine;
    const onLost = (e: Event) => { e.preventDefault(); onFail(); };
    canvas.addEventListener('webglcontextlost', onLost);
    const stop = observeSurface(canvas, (s) => engine.resize(s));
    setLive(true);
    setLaunch((x, y, target) => engine.launchMote(x, y, target));
    return () => {
      stop();
      canvas.removeEventListener('webglcontextlost', onLost);
      setLaunch(null);
      setLive(false);
      engine.dispose();
      engineRef.current = null;
    };
  }, [onFail, setLaunch, setLive, setPeek]);

  useEffect(() => { if (snap) engineRef.current?.setModel(buildSkyModel(snap)); }, [snap]);

  const view = viewForRoute(location.pathname, location.search, snap, mode);
  const viewKey = `${view.level}|${view.galaxyId ?? ''}|${view.goalId ?? ''}|${view.projectId ?? ''}`;
  const first = useRef(true);
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setView(view);
    if (first.current) {
      first.current = false;
      let seen = false;
      try { seen = sessionStorage.getItem(ARRIVED) === '1'; sessionStorage.setItem(ARRIVED, '1'); } catch { /* storage may be off */ }
      if (!seen && view.level === 'mind' && !motionReduced()) { engine.arrive(); introRef.current?.classList.add('skyintro--play'); }
    }
    setPeek(null);
  }, [viewKey]);

  return (
    <div className={`skystage skystage--${view.level}`}>
      <canvas ref={canvasRef} className="skystage__canvas" aria-label="Your mind as a sky: each galaxy is an area of life, goals are stars, projects are planets, and thoughts drift as light. The list view holds the same things as text." />
      <div ref={layerRef} className="skystage__labels" />
      <div ref={introRef} className="skyintro" aria-hidden="true"><p>The Museum of</p><h1>My <em>Mind</em></h1></div>
    </div>
  );
}

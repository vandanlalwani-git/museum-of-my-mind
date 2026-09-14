import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { hashString, mulberry32 } from '@/lib/rng';
import { motionReduced } from '@/lib/motion';
import type { Action, Goal, Project } from '@/types';
import type { SkyLayout } from './layout';
import { ORBIT_SQUASH, nextActionFor, resolvePositions, skyTime } from './layout';

interface Props {
  layout: SkyLayout;
  goals: Goal[];
  projects: Project[];
  actions: Action[];
  selectedGoalId: string | null;
  emphasisProjectId: string | null;
  onSelectGoal: (id: string | null) => void;
  onSelectProject: (id: string) => void;
  onUnsupported?: () => void;
  /** 'full' draws everything; 'overlay' leaves stars, glow, and bodies to the 3D layer beneath. */
  mode?: 'full' | 'overlay';
  pointerRef?: RefObject<{ x: number; y: number }>;
  onActiveGoal?: (id: string | null) => void;
}

interface Pos { x: number; y: number; id: string; kind: 'goal' | 'project' }

const COLORS = {
  parchment: '#e8dcc4', parchmentDim: '#a89f8c', parchmentFaint: '#5f5a4f',
  gold: '#c9a961', goldDim: '#8a7440', verdigris: '#5e8b6e', ember: '#a8553f',
};

const HIT_RADIUS = 18;

/**
 * Goals as constellations, projects in orbit, the next action lit.
 * 2D canvas, deterministic layout, subtle drift. Under reduced motion the
 * sky is still. Keyboard: arrows move between goals, Enter selects, Escape clears.
 */
export function SkyCanvas(props: Props) {
  const { layout, goals, projects, actions, selectedGoalId, emphasisProjectId, onSelectGoal, onSelectProject, onUnsupported } = props;
  const ref = useRef<HTMLCanvasElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState<number>(-1);
  const state = useRef({ hoverId: null as string | null, pointer: { x: 0.5, y: 0.5 }, positions: [] as Pos[], focusId: null as string | null, reportedActive: undefined as string | null | undefined });
  const propsRef = useRef(props);
  propsRef.current = props;
  state.current.hoverId = hoverId;
  state.current.focusId = focusIndex >= 0 ? (layout.goals[focusIndex]?.id ?? null) : null;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) { onUnsupported?.(); return; }

    const reduced = motionReduced();
    let w = 0, h = 0, dpr = 1, raf = 0;
    let bg: { x: number; y: number; r: number; a: number; depth: number }[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rng = mulberry32(hashString('observatory-bg'));
      const n = Math.floor((w * h) / 10_000 * 0.7);
      bg = Array.from({ length: n }, () => ({ x: rng(), y: rng(), r: 0.4 + rng() * 0.9, a: 0.15 + rng() * 0.45, depth: 0.3 + rng() * 0.7 }));
    };

    const draw = (now: number) => {
      const p = propsRef.current;
      const st = state.current;
      const overlay = p.mode === 'overlay';
      const t = reduced ? 0 : skyTime(now);
      const minDim = Math.min(w, h);
      const goalById = new Map(p.goals.map((g) => [g.id, g]));
      const projectById = new Map(p.projects.map((pr) => [pr.id, pr]));

      ctx.clearRect(0, 0, w, h);

      // Background stars with gentle parallax (the dome draws these in overlay mode).
      const px = (st.pointer.x - 0.5) * 14, py = (st.pointer.y - 0.5) * 10;
      for (const s of overlay ? [] : bg) {
        ctx.globalAlpha = s.a;
        ctx.fillStyle = COLORS.parchmentDim;
        ctx.beginPath();
        ctx.arc(s.x * w - px * s.depth, s.y * h - py * s.depth, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Resolve positions through the shared resolver so the dome agrees.
      const resolved = resolvePositions(p.layout, w, h, t);
      const positions: Pos[] = [];
      const goalPos = resolved.goals;
      const projPos = resolved.projects;
      for (const gn of p.layout.goals) positions.push({ ...goalPos.get(gn.id)!, id: gn.id, kind: 'goal' });
      for (const pn of p.layout.projects) positions.push({ ...projPos.get(pn.id)!, id: pn.id, kind: 'project' });
      st.positions = positions;

      const activeGoalId = st.hoverId && goalById.has(st.hoverId) ? st.hoverId
        : st.hoverId && projectById.has(st.hoverId) ? (p.layout.byId.get(st.hoverId) as { goalId?: string | null } | undefined)?.goalId ?? null
        : p.selectedGoalId ?? st.focusId;
      if (st.reportedActive !== activeGoalId) { st.reportedActive = activeGoalId; p.onActiveGoal?.(activeGoalId); }

      // Orbit ring and constellation lines.
      for (const gn of p.layout.goals) {
        const gp = goalPos.get(gn.id)!;
        const goal = goalById.get(gn.id);
        const lit = activeGoalId === gn.id;
        const dormant = goal?.state === 'dormant';
        if (lit && gn.projectIds.length && !overlay) {
          ctx.strokeStyle = COLORS.goldDim;
          ctx.globalAlpha = 0.28;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(gp.x, gp.y, gn.orbit * minDim, gn.orbit * minDim * ORBIT_SQUASH, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        for (const pid of gn.projectIds) {
          const pp = projPos.get(pid)!;
          ctx.strokeStyle = lit ? COLORS.gold : COLORS.goldDim;
          ctx.globalAlpha = lit ? 0.55 : dormant ? 0.14 : 0.26;
          ctx.lineWidth = lit ? 1 : 0.75;
          ctx.beginPath(); ctx.moveTo(gp.x, gp.y); ctx.lineTo(pp.x, pp.y); ctx.stroke();
        }
      }
      // Secondary goal links (a project serving more than one goal).
      ctx.setLineDash([2, 5]);
      for (const pr of p.projects) {
        if (pr.goalIds.length < 2) continue;
        const pp = projPos.get(pr.id); if (!pp) continue;
        const home = (p.layout.byId.get(pr.id) as { goalId?: string | null } | undefined)?.goalId ?? null;
        for (const gid of pr.goalIds) {
          if (gid === home) continue;
          const gp = goalPos.get(gid); if (!gp) continue;
          ctx.strokeStyle = COLORS.goldDim; ctx.globalAlpha = activeGoalId === gid || activeGoalId === home ? 0.4 : 0.15; ctx.lineWidth = 0.75;
          ctx.beginPath(); ctx.moveTo(pp.x, pp.y); ctx.lineTo(gp.x, gp.y); ctx.stroke();
        }
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Project stars.
      for (const pn of p.layout.projects) {
        const pr = projectById.get(pn.id); if (!pr) continue;
        const pp = projPos.get(pn.id)!;
        const lit = activeGoalId !== null && (pn.goalId === activeGoalId || pr.goalIds.includes(activeGoalId ?? ''));
        const hovered = st.hoverId === pn.id;
        const r = 1.8 + pr.progress * 2.2;
        let fill = COLORS.parchment, alpha = 0.9;
        if (pr.status === 'paused') { fill = COLORS.parchmentDim; alpha = 0.8; }
        if (pr.status === 'done') { fill = COLORS.verdigris; alpha = 0.95; }
        if (pr.status === 'idea') { alpha = 0.7; }
        if (!lit && !pn.goalId) alpha *= 0.6;
        ctx.globalAlpha = lit || hovered ? Math.min(1, alpha + 0.1) : alpha * 0.75;
        ctx.fillStyle = fill;
        ctx.beginPath();
        if (overlay) { /* the dome draws the body */ }
        else if (pr.status === 'idea') { ctx.strokeStyle = fill; ctx.lineWidth = 1; ctx.arc(pp.x, pp.y, r, 0, Math.PI * 2); ctx.stroke(); }
        else { ctx.arc(pp.x, pp.y, r, 0, Math.PI * 2); ctx.fill(); }

        // Open next action: a small gold companion.
        const next = pr.status === 'active' ? nextActionFor(pr.id, p.actions) : undefined;
        if (next) {
          ctx.globalAlpha = lit ? 0.95 : 0.6;
          ctx.fillStyle = COLORS.gold;
          ctx.beginPath(); ctx.arc(pp.x + r + 3.5, pp.y - r - 1, 1.4, 0, Math.PI * 2); ctx.fill();
        }
        // Emphasis: the next action for the goal in focus.
        if (p.emphasisProjectId === pn.id) {
          const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.6);
          ctx.strokeStyle = COLORS.gold;
          ctx.globalAlpha = 0.35 + 0.45 * pulse;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(pp.x, pp.y, r + 5 + pulse * 2.5, 0, Math.PI * 2); ctx.stroke();
          const grd = ctx.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, r + 16);
          grd.addColorStop(0, 'rgba(201,169,97,0.35)'); grd.addColorStop(1, 'rgba(201,169,97,0)');
          ctx.globalAlpha = 0.5 + 0.3 * pulse; ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(pp.x, pp.y, r + 16, 0, Math.PI * 2); ctx.fill();
        }
        // Project label when its goal is lit.
        if (lit || hovered) {
          ctx.globalAlpha = hovered ? 1 : 0.85;
          ctx.fillStyle = hovered ? COLORS.parchment : COLORS.parchmentDim;
          ctx.font = `500 11px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          label(ctx, truncate(pr.title, 28), pp.x + r + 8, pp.y + (next ? 4 : 0), w, 'left');
        }
      }
      ctx.globalAlpha = 1;

      // Goal stars.
      for (const gn of p.layout.goals) {
        const goal = goalById.get(gn.id); if (!goal) continue;
        const gp = goalPos.get(gn.id)!;
        const lit = activeGoalId === gn.id;
        const selected = p.selectedGoalId === gn.id;
        const dormant = goal.state === 'dormant';
        const r = 3.2 + Math.min(gn.projectIds.length, 5) * 0.7;
        if (!dormant && !overlay) {
          const glowR = r * (lit ? 7 : 4.5);
          const grd = ctx.createRadialGradient(gp.x, gp.y, 0, gp.x, gp.y, glowR);
          grd.addColorStop(0, lit ? 'rgba(201,169,97,0.45)' : 'rgba(201,169,97,0.22)');
          grd.addColorStop(1, 'rgba(201,169,97,0)');
          ctx.fillStyle = grd; ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.arc(gp.x, gp.y, glowR, 0, Math.PI * 2); ctx.fill();
        }
        if (!overlay) {
          ctx.globalAlpha = dormant ? 0.55 : 1;
          ctx.fillStyle = dormant ? COLORS.parchmentDim : lit ? COLORS.gold : COLORS.parchment;
          ctx.beginPath(); ctx.arc(gp.x, gp.y, r, 0, Math.PI * 2); ctx.fill();
        }
        if ((selected && !overlay) || st.focusId === gn.id) {
          ctx.strokeStyle = COLORS.gold; ctx.globalAlpha = 0.8; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(gp.x, gp.y, r + 6, 0, Math.PI * 2); ctx.stroke();
        }
        // Label.
        ctx.globalAlpha = dormant ? 0.6 : lit ? 1 : 0.85;
        ctx.fillStyle = lit ? COLORS.gold : dormant ? COLORS.parchmentDim : COLORS.parchment;
        ctx.font = `500 ${lit ? 17 : 15}px "Cormorant Garamond", Georgia, serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        label(ctx, truncate(goal.title, 40), gp.x, gp.y + r + 8, w, 'center');
      }
      ctx.globalAlpha = 1;

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    resize();
    draw(performance.now());
    const ro = new ResizeObserver(() => { resize(); if (reduced) draw(performance.now()); });
    ro.observe(canvas);
    void document.fonts?.ready.then(() => { if (reduced) draw(performance.now()); });

    let redraw: (() => void) | undefined;
    if (reduced) {
      redraw = () => draw(performance.now());
      (canvas as HTMLCanvasElement & { __redraw?: () => void }).__redraw = redraw;
    }
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [onUnsupported]);

  // Under reduced motion there is no loop, so redraw when data changes.
  useEffect(() => {
    const c = ref.current as (HTMLCanvasElement & { __redraw?: () => void }) | null;
    c?.__redraw?.();
  }, [layout, goals, projects, actions, selectedGoalId, emphasisProjectId, hoverId, focusIndex, props.mode]);

  const hit = (clientX: number, clientY: number): Pos | null => {
    const canvas = ref.current; if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    state.current.pointer = { x: x / rect.width, y: y / rect.height };
    if (propsRef.current.pointerRef?.current) { propsRef.current.pointerRef.current.x = state.current.pointer.x; propsRef.current.pointerRef.current.y = state.current.pointer.y; }
    let best: Pos | null = null, bestD = HIT_RADIUS;
    for (const p of state.current.positions) {
      const d = Math.hypot(p.x - x, p.y - y);
      const pad = p.kind === 'goal' ? 6 : 0;
      if (d - pad < bestD) { bestD = d - pad; best = p; }
    }
    return best;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const n = layout.goals.length;
    if (!n) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setFocusIndex((i) => (i + 1) % n); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setFocusIndex((i) => (i - 1 + n) % n); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const g = layout.goals[focusIndex]; if (g) onSelectGoal(g.id); }
    else if (e.key === 'Escape') { onSelectGoal(null); setFocusIndex(-1); }
  };

  const focusedTitle = focusIndex >= 0 ? goals.find((g) => g.id === layout.goals[focusIndex]?.id)?.title : undefined;

  return (
    <canvas
      ref={ref}
      className="sky"
      tabIndex={0}
      role="img"
      aria-label={`Sky with ${layout.goals.length} goal constellations. Use arrow keys to move between goals and Enter to open one.${focusedTitle ? ` Focused: ${focusedTitle}.` : ''}`}
      style={{ cursor: hoverId ? 'pointer' : 'default' }}
      onPointerMove={(e) => setHoverId(hit(e.clientX, e.clientY)?.id ?? null)}
      onPointerLeave={() => setHoverId(null)}
      onClick={(e) => {
        const h = hit(e.clientX, e.clientY);
        if (!h) { onSelectGoal(null); return; }
        if (h.kind === 'goal') onSelectGoal(h.id); else onSelectProject(h.id);
      }}
      onKeyDown={onKeyDown}
    />
  );
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

/** Draw text with a soft obsidian halo, keeping it inside the surface horizontally. */
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, align: CanvasTextAlign) {
  const tw = ctx.measureText(text).width;
  let tx = x;
  if (align === 'center') tx = Math.min(Math.max(x, tw / 2 + 8), w - tw / 2 - 8);
  else if (align === 'left') { if (x + tw > w - 8) { ctx.textAlign = 'right'; tx = x - 14; } }
  const a = ctx.globalAlpha;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(10,11,16,0.85)';
  ctx.globalAlpha = a;
  ctx.strokeText(text, tx, y);
  ctx.restore();
  ctx.fillText(text, tx, y);
  ctx.textAlign = align;
}

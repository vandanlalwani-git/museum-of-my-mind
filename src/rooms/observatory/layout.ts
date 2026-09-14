import { hashString, mulberry32 } from '@/lib/rng';
import { motionReduced } from '@/lib/motion';
import type { Action, Goal, Project } from '@/types';

/**
 * Deterministic sky layout. Positions are normalised: x and y in [0, 1]
 * relative to the drawing surface; orbit radii are fractions of the shorter
 * side. The same goals and projects always produce the same sky.
 */

export interface GoalNode {
  kind: 'goal';
  id: string;
  x: number;
  y: number;
  /** Orbit radius for this goal's projects, as a fraction of min(width, height). */
  orbit: number;
  projectIds: string[];
}

export interface ProjectNode {
  kind: 'project';
  id: string;
  goalId: string | null;
  /** Base angle around the goal, radians. */
  angle: number;
  /** Unmoored projects (no goal) get absolute positions instead. */
  x: number;
  y: number;
}

export interface SkyLayout {
  goals: GoalNode[];
  projects: ProjectNode[];
  byId: Map<string, GoalNode | ProjectNode>;
}

const GOLDEN = 2.399963229728653;

export function isInSky(g: Goal): boolean {
  return g.state === 'active' || g.state === 'dormant';
}

export function layoutSky(goalsIn: Goal[], projectsIn: Project[]): SkyLayout {
  const goals = goalsIn.filter(isInSky).slice().sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const projects = projectsIn.filter((p) => p.status !== 'abandoned').slice().sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const goalIds = new Set(goals.map((g) => g.id));

  const n = goals.length;
  const seedOffset = n ? mulberry32(hashString(goals.map((g) => g.id).join('|')))() * Math.PI * 2 : 0;

  const goalNodes: GoalNode[] = goals.map((g, i) => {
    const rng = mulberry32(hashString(g.id));
    let x = 0.5, y = 0.5;
    if (n > 1) {
      const angle = seedOffset + i * GOLDEN;
      const radius = 0.13 + 0.3 * Math.sqrt((i + 0.5) / n);
      x = 0.5 + Math.cos(angle) * radius * 1.12 + (rng() - 0.5) * 0.05;
      y = 0.5 + Math.sin(angle) * radius * 0.86 + (rng() - 0.5) * 0.05;
    } else {
      x = 0.5 + (rng() - 0.5) * 0.08;
      y = 0.46 + (rng() - 0.5) * 0.06;
    }
    const mine = projects.filter((p) => homeGoal(p, goalIds) === g.id).map((p) => p.id);
    const orbit = 0.085 + Math.min(mine.length, 6) * 0.009;
    return { kind: 'goal', id: g.id, x: clamp(x, 0.14, 0.86), y: clamp(y, 0.14, 0.74), orbit, projectIds: mine };
  });

  const projectNodes: ProjectNode[] = [];
  for (const gn of goalNodes) {
    const rng = mulberry32(hashString('orbit:' + gn.id));
    const start = rng() * Math.PI * 2;
    const count = gn.projectIds.length;
    gn.projectIds.forEach((pid, i) => {
      const angle = start + (i / Math.max(count, 1)) * Math.PI * 2 + (rng() - 0.5) * 0.25;
      projectNodes.push({ kind: 'project', id: pid, goalId: gn.id, angle, x: gn.x, y: gn.y });
    });
  }
  // Projects whose first goal is not in the sky (released goal, or no goal) drift near the lower edge.
  for (const p of projects) {
    if (homeGoal(p, goalIds)) continue;
    const rng = mulberry32(hashString('adrift:' + p.id));
    projectNodes.push({ kind: 'project', id: p.id, goalId: null, angle: 0, x: 0.1 + rng() * 0.8, y: 0.86 + rng() * 0.08 });
  }

  const byId = new Map<string, GoalNode | ProjectNode>();
  for (const g of goalNodes) byId.set(g.id, g);
  for (const p of projectNodes) byId.set(p.id, p);
  return { goals: goalNodes, projects: projectNodes, byId };
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

/** The goal a project orbits: its first goal that is still in the sky. */
function homeGoal(p: Project, inSky: Set<string>): string | null {
  return p.goalIds.find((id) => inSky.has(id)) ?? null;
}

/** The next open action for a project: the oldest not-yet-done action. */
export function nextActionFor(projectId: string, actions: Action[]): Action | undefined {
  return actions
    .filter((a) => a.projectId === projectId && !a.doneAt)
    .sort((a, b) => a.createdAt - b.createdAt)[0];
}

/**
 * The goal's next action: from its most recently updated active project that
 * has an open action. Returns the project too so the sky can emphasise it.
 */
export function nextForGoal(goalId: string, projects: Project[], actions: Action[]): { project: Project; action: Action } | null {
  const candidates = projects
    .filter((p) => p.goalIds.includes(goalId) && p.status === 'active')
    .sort((a, b) => b.updatedAt - a.updatedAt);
  for (const project of candidates) {
    const action = nextActionFor(project.id, actions);
    if (action) return { project, action };
  }
  return null;
}

export const ORBIT_SQUASH = 0.62;   // orbits are seen at a tilt
export const ORBIT_SPEED = 0.012;   // radians per second: one revolution in roughly nine minutes

/** Shared sky clock in seconds. Zero (still) under reduced motion so every layer agrees. */
export function skyTime(now = performance.now()): number {
  return motionReduced() ? 0 : now / 1000;
}

export interface Point { x: number; y: number }
export interface Resolved { goals: Map<string, Point>; projects: Map<string, Point> }

/** Pixel positions for a layout at time t on a w×h surface. Used by both the 2D and 3D layers. */
export function resolvePositions(layout: SkyLayout, w: number, h: number, t: number): Resolved {
  const minDim = Math.min(w, h);
  const goals = new Map<string, Point>();
  for (const gn of layout.goals) goals.set(gn.id, { x: gn.x * w, y: gn.y * h });
  const projects = new Map<string, Point>();
  for (const pn of layout.projects) {
    if (pn.goalId) {
      const gn = layout.byId.get(pn.goalId);
      const gp = goals.get(pn.goalId)!;
      const orbit = (gn && gn.kind === 'goal' ? gn.orbit : 0.09) * minDim;
      const a = pn.angle + t * ORBIT_SPEED;
      projects.set(pn.id, { x: gp.x + Math.cos(a) * orbit, y: gp.y + Math.sin(a) * orbit * ORBIT_SQUASH });
    } else {
      projects.set(pn.id, { x: pn.x * w, y: pn.y * h });
    }
  }
  return { goals, projects };
}

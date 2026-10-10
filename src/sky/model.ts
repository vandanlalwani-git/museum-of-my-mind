/**
 * What the sky shows, derived from the open mind. Positions are seeded from
 * ids, so the same museum always draws the same sky.
 */
import { hashString } from '@/lib/rng';
import { brightness, galaxiesOf, goalsIn, progressOf, projectsOf, thoughtsForGoal, unsorted } from '@/mind/select';
import type { GalaxyHue, MindSnapshot, ProjectShapeKind } from '@/mind/types';

export type Vec3 = [number, number, number];

export interface SkyPlanet { id: string; name: string; caption: string; shape: ProjectShapeKind; progress: number; finished: boolean; r: number; speed: number; ph: number; size: number }
export interface SkyMoon { id: string; text: string; question: boolean }
export interface SkyGoal { id: string; name: string; caption: string; bright: number; quiet: boolean; at: Vec3; planets: SkyPlanet[]; moons: SkyMoon[] }
export interface SkyQuestion { id: string; text: string; at: Vec3 }
export interface SkyGalaxy { id: string; name: string; hue: GalaxyHue; R: number; goals: SkyGoal[]; questions: SkyQuestion[]; nebulaAt: Vec3; unsorted: SkyMoon[] }
export interface SkyModel { galaxies: SkyGalaxy[]; drifting: SkyMoon[]; structure: string }

const unit = (id: string, salt = ''): number => (hashString(id + salt) % 10_000) / 10_000;
const SHAPE_CAPTION: Record<ProjectShapeKind, string> = {
  list: 'a list to finish', number: 'a number to reach', habit: 'a habit to keep', date: 'getting ready for a day', levels: 'a climb in levels', explore: 'a question to explore',
};

export function buildSkyModel(s: MindSnapshot, now = Date.now()): SkyModel {
  const galaxies = galaxiesOf(s).map((g): SkyGalaxy => {
    const goals = goalsIn(s, g.id).filter((x) => x.state !== 'released');
    const R = Math.max(28, Math.min(46, 28 + goals.length * 4));
    const skyGoals = goals.map((goal, i): SkyGoal => {
      const ang = i * 2.39996 + unit(goal.id) * 0.7;
      const rad = R * (0.3 + 0.48 * ((i * 0.618 + unit(goal.id, 'r') * 0.3) % 1));
      const projects = projectsOf(s, goal.id).filter((p) => p.state !== 'dropped');
      const planets = projects.slice(0, 7).map((p, j): SkyPlanet => ({
        id: p.id, name: p.title, caption: p.state === 'finished' ? 'finished' : p.state === 'paused' ? 'paused' : SHAPE_CAPTION[p.shape.kind],
        shape: p.shape.kind, progress: progressOf(s, p, now).fraction, finished: p.state === 'finished',
        r: 4.2 + j * 2.4, speed: Math.max(0.1, 0.33 - j * 0.05), ph: unit(p.id) * Math.PI * 2,
        size: 0.5 + Math.min(0.28, (p.sizeHours ?? 40) / 400),
      }));
      const moons = thoughtsForGoal(s, goal.id).slice(0, 8).map((t) => ({ id: t.id, text: t.text, question: t.isQuestion && !t.answer }));
      return {
        id: goal.id, name: goal.title, caption: `${planets.length} ${planets.length === 1 ? 'project' : 'projects'}`,
        bright: goal.state === 'active' ? brightness(s, goal.id, now) : 0.35, quiet: goal.state !== 'active',
        at: [Math.cos(ang) * rad, 0, Math.sin(ang) * rad], planets, moons,
      };
    });
    const questions = s.thoughts
      .filter((t) => !t.deletedAt && t.galaxyId === g.id && t.state === 'kept' && t.isQuestion && !t.answer && !t.goalId && !t.projectId)
      .slice(0, 6)
      .map((t): SkyQuestion => { const a = unit(t.id) * Math.PI * 2, r = R * (0.45 + unit(t.id, 'q') * 0.35); return { id: t.id, text: t.text, at: [Math.cos(a) * r, 0, Math.sin(a) * r] }; });
    const na = goals.length * 2.39996 + Math.PI;
    return {
      id: g.id, name: g.name, hue: g.hue, R, goals: skyGoals, questions,
      nebulaAt: [Math.cos(na) * R * 0.72, 3, Math.sin(na) * R * 0.72],
      unsorted: unsorted(s, g.id).slice(0, 24).map((t) => ({ id: t.id, text: t.text, question: t.isQuestion })),
    };
  });
  const drifting = unsorted(s, null).slice(0, 24).map((t) => ({ id: t.id, text: t.text, question: t.isQuestion }));
  // Anything that changes where things are, or how many there are, rebuilds the scene; the rest updates in place.
  const structure = JSON.stringify([
    galaxies.map((g) => [g.id, g.hue, g.R, g.goals.map((x) => [x.id, x.planets.map((p) => p.id), x.moons.length]), g.questions.map((q) => q.id), g.unsorted.length]),
    drifting.length,
  ]);
  return { galaxies, drifting, structure };
}

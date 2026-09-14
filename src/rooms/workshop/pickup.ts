import type { Action, Goal, MuseumRecords, Project } from '@/types';

/**
 * Which unfinished projects are worth picking up, and why. Every rule is
 * plain and stated in the reason text; there is no hidden scoring beyond
 * the weights below. Deterministic for a given collection and day.
 */

export interface Pickup {
  project: Project;
  score: number;
  reasons: string[];
}

const DAY = 86_400_000;
const FRESH_DAYS = 7;

export function nextOpenAction(projectId: string, actions: Action[]): Action | undefined {
  return actions.filter((a) => a.projectId === projectId && !a.doneAt).sort((a, b) => a.createdAt - b.createdAt)[0];
}

export function pickUps(records: MuseumRecords, now: number, limit = 3): Pickup[] {
  const activeGoals = new Map(records.goals.filter((g) => g.state === 'active').map((g) => [g.id, g]));
  const out: Pickup[] = [];

  for (const p of records.projects) {
    if (p.status === 'done' || p.status === 'abandoned') continue;
    const days = Math.floor((now - p.lastVisitedAt) / DAY);
    const age = Math.floor((now - p.createdAt) / DAY);
    if (days < FRESH_DAYS) continue; // touched this week: not forgotten

    const reasons: string[] = [];
    let score = 0;
    const next = nextOpenAction(p.id, records.actions);
    const goal: Goal | undefined = p.goalIds.map((id) => activeGoals.get(id)).find(Boolean);

    if (days >= 14 && next) {
      score += 3 + Math.min(days, 180) / 30;
      reasons.push(`Not touched in ${days} days, but it still has a next step: “${next.text}”.`);
    } else if (days >= 14) {
      score += 1 + Math.min(days, 180) / 45;
      reasons.push(`Not touched in ${days} days.`);
    }
    if (goal) {
      score += 1;
      reasons.push(`It serves “${goal.title}”, which is still in the sky.`);
    }
    if (p.status !== 'idea' && p.progress >= 0.7) {
      score += 2;
      reasons.push(`Nearly there: about ${Math.round(p.progress * 100)}% done.`);
    } else if (p.status === 'paused' && days >= 30 && p.progress >= 0.25) {
      score += 2;
      reasons.push(`Resting for ${days} days with real progress behind it (${Math.round(p.progress * 100)}%).`);
    }
    if (p.status === 'idea' && age >= 30) {
      score += 1.5;
      reasons.push(`An idea that has waited ${age} days.`);
    }
    if (score > 0) out.push({ project: p, score, reasons });
  }

  return out
    .sort((a, b) => b.score - a.score || a.project.lastVisitedAt - b.project.lastVisitedAt || a.project.id.localeCompare(b.project.id))
    .slice(0, limit);
}

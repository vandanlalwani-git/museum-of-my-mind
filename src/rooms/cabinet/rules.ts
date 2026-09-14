import { hashString, mulberry32 } from '@/lib/rng';
import type { Link, Memory, MuseumRecords, Note, Project } from '@/types';

/**
 * How the Cabinet chooses what to show. Every rule is plain and produces a
 * sentence the room shows. Scores only order the candidates; the day and the
 * museum seed a small rotation so the same drawer does not open every time,
 * while the same day always opens the same drawer.
 */

export type CabinetKind = 'note' | 'idea' | 'link' | 'memory' | 'project';
export type CabinetItem = Note | Link | Memory | Project;

export interface Curiosity {
  id: string;
  kind: CabinetKind;
  title: string;
  item: CabinetItem;
  score: number;
  reasons: string[];
}

const DAY = 86_400_000;
const MIN_QUIET_DAYS = 7;

export function kindOf(item: CabinetItem): CabinetKind {
  if ('status' in item) return 'project';
  if ('url' in item) return 'link';
  if ('occurredAt' in item) return 'memory';
  return (item as Note).kind === 'idea' ? 'idea' : 'note';
}

function daysAgo(t: number, now: number) { return Math.floor((now - t) / DAY); }

function dayOfYearDistance(a: number, b: number): number {
  const da = new Date(a), db = new Date(b);
  const ya = Date.UTC(2001, da.getMonth(), da.getDate()), yb = Date.UTC(2001, db.getMonth(), db.getDate());
  const diff = Math.abs(ya - yb) / DAY;
  return Math.min(diff, 365 - diff);
}

export function curiosities(records: MuseumRecords, now: number, opts: { limit?: number; exclude?: Set<string>; seed?: string } = {}): Curiosity[] {
  const limit = opts.limit ?? 3;
  const exclude = opts.exclude ?? new Set<string>();
  const activeGoals = new Map(records.goals.filter((g) => g.state === 'active').map((g) => [g.id, g]));
  const projectsById = new Map(records.projects.map((p) => [p.id, p]));

  // Tags touched this week, across everything.
  const recentTags = new Map<string, string>();
  const all: { tags: string[]; lastVisitedAt: number; title: string }[] = [...records.goals, ...records.projects, ...records.notes, ...records.links, ...records.memories];
  for (const r of all) if (daysAgo(r.lastVisitedAt, now) <= 7) for (const t of r.tags) if (!recentTags.has(t)) recentTags.set(t, r.title);

  // Which active goal, if any, an item is tied to.
  const goalFor = (item: CabinetItem): string | undefined => {
    if ('status' in item) return item.goalIds.find((id) => activeGoals.has(id));
    if ('occurredAt' in item) {
      if (item.goalId && activeGoals.has(item.goalId)) return item.goalId;
      if (item.projectId) { const p = projectsById.get(item.projectId); const g = p?.goalIds.find((id) => activeGoals.has(id)); if (g) return g; }
    }
    for (const t of records.threads) {
      const other = t.fromId === item.id ? t.toId : t.toId === item.id ? t.fromId : null;
      if (!other) continue;
      if (activeGoals.has(other)) return other;
      const p = projectsById.get(other);
      const g = p?.goalIds.find((id) => activeGoals.has(id));
      if (g) return g;
    }
    return undefined;
  };

  const candidates: CabinetItem[] = [
    ...records.notes.filter((n) => n.archivedAt === undefined),
    ...records.links.filter((l) => l.archivedAt === undefined),
    ...records.memories.filter((m) => m.archivedAt === undefined),
    ...records.projects.filter((p) => p.status === 'paused' || p.status === 'idea'),
  ];

  const out: Curiosity[] = [];
  for (const item of candidates) {
    if (exclude.has(item.id)) continue;
    if (item.restUntil && item.restUntil > now) continue;
    const quiet = daysAgo(item.lastVisitedAt, now);
    if (quiet < MIN_QUIET_DAYS) continue;
    const kind = kindOf(item);
    const reasons: string[] = [];
    let score = 0;

    if (quiet >= 30) {
      score += 2 + Math.min(quiet, 365) / 60;
      reasons.push(quiet >= 365 ? 'Not opened in over a year.' : `Not opened in ${quiet} days.`);
    } else {
      score += 0.5;
      reasons.push(`Quiet for ${quiet} days.`);
    }

    const goalId = goalFor(item);
    if (goalId) { score += 1.5; reasons.push(`Tied to “${activeGoals.get(goalId)!.title}”, which is still in the sky.`); }

    if (kind === 'project') {
      const p = item as Project;
      const age = daysAgo(p.createdAt, now);
      if (age >= 30) { score += 2; reasons.push(`Started ${age} days ago and never finished (${Math.round(p.progress * 100)}% done).`); }
    } else if (kind === 'idea') {
      const age = daysAgo(item.createdAt, now);
      if (age >= 45) { score += 1; reasons.push(`An idea from ${age} days ago that never became a project.`); }
    }

    const shared = item.tags.find((t) => recentTags.has(t));
    if (shared) { score += 1.5; reasons.push(`Shares the tag “${shared}” with “${recentTags.get(shared)}”, which you touched this week.`); }

    if (kind === 'memory') {
      const m = item as Memory;
      const years = Math.round(daysAgo(m.occurredAt, now) / 365);
      if (years >= 1 && dayOfYearDistance(m.occurredAt, now) <= 14) {
        score += 2.5;
        reasons.push(`Happened around this time of year, ${years === 1 ? 'a year' : `${years} years`} ago.`);
      }
    }

    out.push({ id: item.id, kind, title: item.title, item, score, reasons });
  }

  out.sort((a, b) => b.score - a.score || a.item.lastVisitedAt - b.item.lastVisitedAt || a.id.localeCompare(b.id));
  const top = out.slice(0, Math.max(limit, 8));
  if (top.length === 0) return [];
  // Daily rotation: deterministic for a given day and museum, different across days.
  const dayIndex = Math.floor(now / DAY);
  const rng = mulberry32(hashString(`${opts.seed ?? ''}:${dayIndex}`));
  const start = Math.floor(rng() * top.length);
  const rotated = [...top.slice(start), ...top.slice(0, start)];
  return rotated.slice(0, limit);
}

import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force';
import { hashString, mulberry32 } from '@/lib/rng';
import type { Goal, Link, Memory, MuseumRecords, Note, Project, Thread, ThreadKind } from '@/types';

/**
 * The Archive map. Nodes are notes, ideas, links, memories, and the tags they
 * share; goals and projects appear only when a thread reaches them. Edges are
 * explicit threads (gold) and tag membership (hairline). Nothing here infers
 * meaning: every line exists because the keeper wrote a tag or a thread.
 *
 * Layout is a seeded d3-force run to completion, so the same collection
 * always draws the same map.
 */

export type ArchiveNodeKind = 'note' | 'idea' | 'link' | 'memory' | 'tag' | 'goal' | 'project';
export type ArchiveItem = Note | Link | Memory;

export interface ArchiveNode extends SimulationNodeDatum {
  id: string;
  kind: ArchiveNodeKind;
  title: string;
  r: number;
  tags: string[];
  degree: number;
  x: number;
  y: number;
}

export interface ArchiveEdge extends SimulationLinkDatum<ArchiveNode> {
  id: string;
  source: string | ArchiveNode;
  target: string | ArchiveNode;
  kind: 'thread' | 'tag';
  threadKind?: ThreadKind;
  why?: string;
}

export interface ArchiveGraph {
  nodes: ArchiveNode[];
  edges: ArchiveEdge[];
  byId: Map<string, ArchiveNode>;
  width: number;
  height: number;
}

export const MAP_W = 1000;
export const MAP_H = 700;

export function itemKind(item: ArchiveItem): 'note' | 'idea' | 'link' | 'memory' {
  if ('url' in item) return 'link';
  if ('occurredAt' in item) return 'memory';
  return item.kind === 'idea' ? 'idea' : 'note';
}

export function isArchived(item: ArchiveItem): boolean {
  return typeof item.archivedAt === 'number';
}

export function allItems(r: MuseumRecords): ArchiveItem[] {
  return [...r.notes, ...r.links, ...r.memories];
}

export function buildGraph(records: MuseumRecords): ArchiveGraph {
  const items = allItems(records).filter((i) => !isArchived(i));
  const itemIds = new Set(items.map((i) => i.id));
  const goalsById = new Map(records.goals.map((g) => [g.id, g]));
  const projectsById = new Map(records.projects.map((p) => [p.id, p]));

  const nodes: ArchiveNode[] = [];
  const byId = new Map<string, ArchiveNode>();
  const add = (n: ArchiveNode) => { nodes.push(n); byId.set(n.id, n); };

  for (const item of items) {
    add({ id: item.id, kind: itemKind(item), title: item.title, r: 7, tags: item.tags, degree: 0, x: 0, y: 0 });
  }

  // Tags shared by items become hub nodes.
  const tagCounts = new Map<string, number>();
  for (const item of items) for (const t of item.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  for (const [tag, count] of [...tagCounts.entries()].sort()) {
    add({ id: 'tag:' + tag, kind: 'tag', title: tag, r: 3 + Math.min(count, 6) * 0.6, tags: [], degree: count, x: 0, y: 0 });
  }

  // Goals and projects are drawn only when a thread reaches them from an item.
  const anchor = (id: string): ArchiveNode | undefined => {
    if (byId.has(id)) return byId.get(id);
    const g: Goal | undefined = goalsById.get(id);
    if (g) { const n: ArchiveNode = { id, kind: 'goal', title: g.title, r: 6, tags: g.tags, degree: 0, x: 0, y: 0 }; add(n); return n; }
    const p: Project | undefined = projectsById.get(id);
    if (p) { const n: ArchiveNode = { id, kind: 'project', title: p.title, r: 5, tags: p.tags, degree: 0, x: 0, y: 0 }; add(n); return n; }
    return undefined;
  };

  const edges: ArchiveEdge[] = [];
  for (const t of records.threads as Thread[]) {
    const fromItem = itemIds.has(t.fromId), toItem = itemIds.has(t.toId);
    if (!fromItem && !toItem) continue;
    const a = anchor(t.fromId), b = anchor(t.toId);
    if (!a || !b) continue;
    edges.push({ id: t.id, source: a.id, target: b.id, kind: 'thread', threadKind: t.kind, ...(t.why ? { why: t.why } : {}) });
    a.degree++; b.degree++;
  }
  for (const item of items) {
    for (const tag of item.tags) {
      edges.push({ id: `tag:${item.id}:${tag}`, source: item.id, target: 'tag:' + tag, kind: 'tag' });
      byId.get(item.id)!.degree++;
    }
  }

  // Seeded start positions, then a deterministic force run to rest.
  const rng = mulberry32(hashString(nodes.map((n) => n.id).join('|')));
  for (const n of nodes) {
    const a = rng() * Math.PI * 2;
    const rad = n.kind === 'tag' ? 80 + rng() * 80 : 160 + rng() * 140;
    n.x = MAP_W / 2 + Math.cos(a) * rad;
    n.y = MAP_H / 2 + Math.sin(a) * rad * 0.8;
  }
  const sim = forceSimulation<ArchiveNode>(nodes)
    .randomSource(rng)
    .force('link', forceLink<ArchiveNode, ArchiveEdge>(edges).id((d) => d.id).distance((e) => (e.kind === 'tag' ? 62 : 120)).strength((e) => (e.kind === 'tag' ? 0.5 : 0.7)))
    .force('charge', forceManyBody<ArchiveNode>().strength((d) => (d.kind === 'tag' ? -120 : -260)))
    .force('center', forceCenter(MAP_W / 2, MAP_H / 2).strength(0.6))
    .force('x', forceX(MAP_W / 2).strength(0.045))
    .force('y', forceY(MAP_H / 2).strength(0.07))
    .force('collide', forceCollide<ArchiveNode>().radius((d) => d.r + (d.kind === 'tag' ? 18 : 30)).iterations(2))
    .stop();
  sim.tick(320);

  const pad = 48;
  for (const n of nodes) {
    n.x = Math.max(pad, Math.min(MAP_W - pad, n.x));
    n.y = Math.max(pad, Math.min(MAP_H - pad, n.y));
  }
  return { nodes, edges, byId, width: MAP_W, height: MAP_H };
}

export function neighboursOf(graph: ArchiveGraph, id: string): Set<string> {
  const out = new Set<string>();
  for (const e of graph.edges) {
    const s = typeof e.source === 'string' ? e.source : e.source.id;
    const t = typeof e.target === 'string' ? e.target : e.target.id;
    if (s === id) out.add(t);
    if (t === id) out.add(s);
  }
  return out;
}

export function edgeEnds(e: ArchiveEdge): [string, string] {
  return [typeof e.source === 'string' ? e.source : e.source.id, typeof e.target === 'string' ? e.target : e.target.id];
}

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { THREAD_LABEL } from '@/types';
import { edgeEnds, neighboursOf, type ArchiveGraph, type ArchiveNode } from './graph';

interface Props {
  graph: ArchiveGraph;
  selectedId: string | null;
  /** Ids that match the current search; everything else is dimmed. Null means no filter. */
  matchIds: Set<string> | null;
  onSelect: (id: string | null) => void;
}

const KIND_LABEL: Record<ArchiveNode['kind'], string> = {
  note: 'note', idea: 'idea', link: 'link', memory: 'memory', tag: 'tag', goal: 'goal', project: 'project',
};

/**
 * The wall: an SVG map of items, tags, and the threads between them.
 * Pan by dragging the background, zoom with the wheel, double-click to reset.
 * Every node is a focusable button, so the map works by keyboard too.
 */
export function ArchiveMap({ graph, selectedId, matchIds, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);

  const box = useMemo(() => {
    if (!graph.nodes.length) return { x: 0, y: 0, w: graph.width, h: graph.height };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of graph.nodes) { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y); }
    const pad = 90;
    const w = Math.max(maxX - minX + pad * 2, 320), h = Math.max(maxY - minY + pad * 2, 240);
    return { x: (minX + maxX) / 2 - w / 2, y: (minY + maxY) / 2 - h / 2, w, h };
  }, [graph]);

  const focusId = hoverId ?? selectedId;
  const neighbours = useMemo(() => (focusId ? neighboursOf(graph, focusId) : null), [graph, focusId]);

  const isLit = (id: string) => !focusId || id === focusId || neighbours?.has(id);
  const isMatch = (id: string) => !matchIds || matchIds.has(id) || id.startsWith('tag:');

  useEffect(() => { setView({ k: 1, tx: 0, ty: 0 }); }, [graph.width, graph.height, graph.nodes.length]);

  const toLocal = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / box.w, rect.height / box.h);
    const ox = (rect.width - box.w * scale) / 2, oy = (rect.height - box.h * scale) / 2;
    return { x: box.x + (clientX - rect.left - ox) / scale, y: box.y + (clientY - rect.top - oy) / scale };
  }, [box]);

  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const p = toLocal(e.clientX, e.clientY);
    const factor = Math.exp(-e.deltaY * 0.0015);
    setView((v) => {
      const k = Math.max(0.5, Math.min(4, v.k * factor));
      const ratio = k / v.k;
      return { k, tx: p.x - (p.x - v.tx) * ratio, ty: p.y - (p.y - v.ty) * ratio };
    });
  };
  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest('[data-node]')) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false };
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const scale = Math.min(rect.width / box.w, rect.height / box.h);
    const dx = (e.clientX - drag.current.x) / scale, dy = (e.clientY - drag.current.y) / scale;
    if (Math.hypot(dx, dy) > 2) drag.current.moved = true;
    setView((v) => ({ ...v, tx: drag.current!.tx + dx, ty: drag.current!.ty + dy }));
  };
  const onPointerUp = () => {
    if (drag.current && !drag.current.moved) onSelect(null);
    drag.current = null;
  };

  const nodeKey = (e: KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); }
    if (e.key === 'Escape') onSelect(null);
  };

  return (
    <svg
      ref={svgRef}
      className="wall"
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label={`Map of ${graph.nodes.length} items and tags with ${graph.edges.filter((e) => e.kind === 'thread').length} threads. Drag to pan, scroll to zoom.`}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => setView({ k: 1, tx: 0, ty: 0 })}
    >
      <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
        <g className="wall__edges">
          {graph.edges.map((e) => {
            const [s, t] = edgeEnds(e);
            const a = graph.byId.get(s), b = graph.byId.get(t);
            if (!a || !b) return null;
            const lit = focusId ? (s === focusId || t === focusId) : true;
            const dim = !isMatch(s) && !isMatch(t);
            return (
              <line
                key={e.id}
                className={`wall__edge wall__edge--${e.kind} ${lit ? 'is-lit' : ''} ${dim ? 'is-dim' : ''}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              >
                {e.kind === 'thread' && <title>{a.title} {THREAD_LABEL[e.threadKind!]} {b.title}{e.why ? ` — ${e.why}` : ''}</title>}
              </line>
            );
          })}
        </g>
        <g className="wall__nodes">
          {graph.nodes.map((n) => {
            const lit = isLit(n.id);
            const match = isMatch(n.id);
            const selected = n.id === selectedId;
            return (
              <g
                key={n.id}
                data-node={n.id}
                className={`wall__node wall__node--${n.kind} ${lit ? 'is-lit' : 'is-far'} ${match ? '' : 'is-dim'} ${selected ? 'is-selected' : ''} ${hoverId === n.id ? 'is-hover' : ''}`}
                transform={`translate(${n.x} ${n.y})`}
                role="button"
                tabIndex={0}
                aria-label={`${KIND_LABEL[n.kind]}: ${n.title}`}
                aria-pressed={selected}
                onClick={(e) => { e.stopPropagation(); onSelect(n.id); }}
                onKeyDown={(e) => nodeKey(e, n.id)}
                onPointerEnter={() => setHoverId(n.id)}
                onPointerLeave={() => setHoverId(null)}
                onFocus={() => setHoverId(n.id)}
                onBlur={() => setHoverId(null)}
              >
                <circle className="wall__hit" r={n.kind === 'tag' ? 14 : 18} />
                {selected && <circle className="wall__ring" r={n.r + 7} />}
                <Glyph node={n} />
                <text
                  className="wall__label"
                  y={n.kind === 'tag' ? n.r + 11 : n.r + 14}
                  textAnchor="middle"
                >
                  {n.kind === 'tag' ? n.title.toUpperCase() : truncate(n.title, 26)}
                </text>
              </g>
            );
          })}
        </g>
      </g>
    </svg>
  );
}

function Glyph({ node: n }: { node: ArchiveNode }) {
  switch (n.kind) {
    case 'idea': return <circle className="wall__glyph" r={n.r} />;
    case 'link': return <rect className="wall__glyph" x={-n.r * 0.85} y={-n.r * 0.85} width={n.r * 1.7} height={n.r * 1.7} transform="rotate(45)" />;
    case 'memory': return <circle className="wall__glyph" r={n.r} />;
    case 'tag': return <circle className="wall__glyph" r={n.r} />;
    case 'goal': return <path className="wall__glyph" d={star(n.r + 3)} />;
    case 'project': return <circle className="wall__glyph" r={n.r} />;
    default: return <circle className="wall__glyph" r={n.r} />;
  }
}

function star(r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    pts.push(`${Math.cos(a) * rad},${Math.sin(a) * rad}`);
  }
  return `M${pts.join('L')}Z`;
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

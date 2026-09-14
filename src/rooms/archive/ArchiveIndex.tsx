import { useMemo, useState } from 'react';
import { Instrument } from '@/components/Instrument';
import { relativeAge } from '@/lib/dates';
import { snippet } from '@/lib/text';
import type { MuseumRecords } from '@/types';
import { Capture, type CaptureKind } from './Capture';
import { allItems, isArchived, itemKind, type ArchiveItem } from './graph';

export const ITEM_KIND_LABEL = { note: 'Thought', idea: 'Idea', link: 'Link', memory: 'Memory' } as const;

interface Props {
  records: MuseumRecords;
  query: string;
  onQuery: (q: string) => void;
  tagFilter: string | null;
  onTagFilter: (t: string | null) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCapture: (kind: CaptureKind, text: string) => Promise<void>;
}

export function matchesQuery(item: ArchiveItem, q: string): boolean {
  if (!q) return true;
  const hay = [item.title, 'body' in item ? item.body : '', 'url' in item ? item.url + ' ' + item.whySaved : '', item.tags.join(' ')].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

export function ArchiveIndex({ records, query, onQuery, tagFilter, onTagFilter, selectedId, onSelect, onCapture }: Props) {
  const [showArchived, setShowArchived] = useState(false);
  const items = useMemo(() => allItems(records), [records]);
  const threadCount = (id: string) => records.threads.filter((t) => t.fromId === id || t.toId === id).length;

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items) if (!isArchived(i)) for (const t of i.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 14);
  }, [items]);

  const visible = items
    .filter((i) => matchesQuery(i, query) && (!tagFilter || i.tags.includes(tagFilter)))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const onWall = visible.filter((i) => !isArchived(i));
  const putAway = visible.filter(isArchived);

  return (
    <div className="panel">
      <header className="panel__head">
        <span className="plaque">On the wall · {items.filter((i) => !isArchived(i)).length}</span>
        <h2 className="panel__title">The Archive</h2>
        <p className="panel__why">Notes, ideas, links, and memories, pinned to a wall with the threads you tie between them. Nothing is connected unless you connect it.</p>
      </header>

      <Capture onCapture={onCapture} />

      <div className="arc-search">
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search titles, bodies, tags"
          aria-label="Search the archive"
        />
        {(query || tagFilter) && <Instrument tone="quiet" onClick={() => { onQuery(''); onTagFilter(null); }}>Clear</Instrument>}
      </div>

      {tags.length > 0 && (
        <ul className="tags" aria-label="Tags">
          {tags.map(([t, n]) => (
            <li key={t}>
              <button type="button" className={`tag ${tagFilter === t ? 'is-active' : ''}`} aria-pressed={tagFilter === t} onClick={() => onTagFilter(tagFilter === t ? null : t)}>
                {t} <span className="tag__n tabular">{n}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ul className="items">
        {onWall.map((item) => (
          <li key={item.id}>
            <button type="button" className={`item ${selectedId === item.id ? 'is-selected' : ''} item--${itemKind(item)}`} onClick={() => onSelect(item.id)}>
              <span className="item__glyph" aria-hidden="true" />
              <span className="item__text">
                <span className="item__title display">{item.title}</span>
                <span className="item__snippet">{'url' in item ? item.whySaved || item.url : snippet(item.body, 100)}</span>
                <span className="item__meta plaque">
                  {ITEM_KIND_LABEL[itemKind(item)]} · {relativeAge(item.updatedAt)}{threadCount(item.id) ? ` · ${threadCount(item.id)} thread${threadCount(item.id) === 1 ? '' : 's'}` : ''}{item.tags.length ? ` · ${item.tags.join(', ')}` : ''}
                </span>
              </span>
            </button>
          </li>
        ))}
        {onWall.length === 0 && <li className="panel__empty">Nothing on the wall matches.</li>}
      </ul>

      {putAway.length > 0 && (
        <section className="panel__section">
          <div className="panel__section-head">
            <span className="plaque">Put away · {putAway.length}</span>
            <Instrument tone="quiet" onClick={() => setShowArchived((v) => !v)}>{showArchived ? 'Hide' : 'Show'}</Instrument>
          </div>
          {showArchived && (
            <ul className="items items--archived">
              {putAway.map((item) => (
                <li key={item.id}>
                  <button type="button" className={`item ${selectedId === item.id ? 'is-selected' : ''} item--${itemKind(item)}`} onClick={() => onSelect(item.id)}>
                    <span className="item__glyph" aria-hidden="true" />
                    <span className="item__text">
                      <span className="item__title display">{item.title}</span>
                      <span className="item__meta plaque">{ITEM_KIND_LABEL[itemKind(item)]} · put away {relativeAge(item.archivedAt ?? item.updatedAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

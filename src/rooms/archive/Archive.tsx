import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { makeLink, makeMemory, makeNote, makeThread, touched } from '@/data/factories';
import { useMuseumStore } from '@/store/museum';
import { useUiStore } from '@/store/ui';
import { splitCapture } from '@/lib/text';
import type { RecordType, ThreadKind } from '@/types';
import { ArchiveIndex, matchesQuery } from './ArchiveIndex';
import { ArchiveMap } from './ArchiveMap';
import { Capture, type CaptureKind } from './Capture';
import { ItemPanel, type ArchiveOps } from './ItemPanel';
import { allItems, buildGraph, isArchived, type ArchiveItem } from './graph';
import './archive.css';

function typeOf(item: ArchiveItem): RecordType {
  return 'url' in item ? 'links' : 'occurredAt' in item ? 'memories' : 'notes';
}

export default function Archive() {
  const museumId = useMuseumStore((s) => s.activeMuseumId)!;
  const records = useMuseumStore((s) => s.records);
  const upsert = useMuseumStore((s) => s.upsert);
  const remove = useMuseumStore((s) => s.remove);
  const say = useUiStore((s) => s.say);

  const [params] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get('item'));
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const items = useMemo(() => allItems(records), [records]);
  const graph = useMemo(() => buildGraph(records), [records]);
  const selected = items.find((i) => i.id === selectedId) ?? null;
  const selectedNode = selectedId ? graph.byId.get(selectedId) ?? null : null;
  const empty = items.length === 0;

  const matchIds = useMemo(() => {
    if (!query && !tagFilter) return null;
    return new Set(items.filter((i) => matchesQuery(i, query) && (!tagFilter || i.tags.includes(tagFilter))).map((i) => i.id));
  }, [items, query, tagFilter]);

  // Reading an item counts as a visit.
  useEffect(() => {
    if (!selected) return;
    if (Date.now() - selected.lastVisitedAt < 60_000) return;
    void upsert(typeOf(selected), { ...selected, lastVisitedAt: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selectFromMap = useCallback((id: string | null) => {
    if (id && id.startsWith('tag:')) { setTagFilter(id.slice(4)); setSelectedId(null); return; }
    setSelectedId(id);
  }, []);

  const capture = useCallback(async (kind: CaptureKind, text: string) => {
    if (kind === 'link') {
      const [url, ...rest] = text.split(/\s+/);
      const item = makeLink(museumId, { url: url!, whySaved: rest.join(' ') });
      await upsert('links', item);
      say('Kept. Give it a why, a tag, or a thread when you like.');
      return;
    }
    if (kind === 'memory') {
      const { title, body } = splitCapture(text);
      await upsert('memories', makeMemory(museumId, { title, body }));
      say('Kept as a memory, dated today. Edit it to change the date.');
      return;
    }
    const { title, body } = splitCapture(text);
    await upsert('notes', makeNote(museumId, { title, body, kind: kind === 'idea' ? 'idea' : 'note' }));
    say(kind === 'idea' ? 'An idea on the wall.' : 'Kept.');
  }, [museumId, upsert, say]);

  const ops: ArchiveOps = useMemo(() => ({
    async updateItem(item, patch) { await upsert(typeOf(item), touched(item, patch as never)); },
    async setTags(item, tags) { await upsert(typeOf(item), touched(item, { tags } as never)); },
    async archiveItem(item) { await upsert(typeOf(item), touched(item, { archivedAt: Date.now() } as never)); say('Put away. It leaves the wall but stays in the drawers.'); },
    async restoreItem(item) {
      const { archivedAt: _a, ...rest } = item as ArchiveItem & { archivedAt?: number };
      await upsert(typeOf(item), touched(rest as ArchiveItem) as never);
      say('Back on the wall.');
    },
    async deleteItem(item) {
      for (const t of records.threads) if (t.fromId === item.id || t.toId === item.id) await remove('threads', t.id);
      await remove(typeOf(item), item.id);
      setSelectedId(null);
      say('Let go.');
    },
    async addThread(fromId, toId, kind: ThreadKind, why) {
      await upsert('threads', makeThread(museumId, fromId, toId, kind, why));
      say('A thread ties them now.');
    },
    async updateThread(thread, patch) {
      const { why: _old, ...rest } = thread;
      await upsert('threads', touched({ ...rest, ...(patch.why ? { why: patch.why } : {}) } as typeof thread, { kind: patch.kind }));
      say('The thread is re-tied.');
    },
    async removeThread(id) { await remove('threads', id); },
  }), [museumId, records.threads, upsert, remove, say]);

  return (
    <section className={`arc ${empty ? 'arc--empty' : ''}`}>
      <h1 className="visually-hidden">Archive</h1>
      <div className="arc__wall">
        {!empty && <ArchiveMap graph={graph} selectedId={selectedId} matchIds={matchIds} onSelect={selectFromMap} />}
        {empty && (
          <div className="arc__invite">
            <span className="plaque">The wall is bare</span>
            <h1 className="arc__invite-title">Pin the first thing to it.</h1>
            <p className="arc__invite-lede">A thought, an idea, a link worth keeping, a memory. Later you will tie threads between them, and the wall becomes a map of how you think.</p>
            <Capture onCapture={capture} large autoFocus />
          </div>
        )}
        {!empty && (
          <ul className="arc__legend" aria-label="Legend">
            <li><span className="lg lg--note" /> thought</li>
            <li><span className="lg lg--idea" /> idea</li>
            <li><span className="lg lg--link" /> link</li>
            <li><span className="lg lg--memory" /> memory</li>
            <li><span className="lg lg--tag" /> tag</li>
            <li><span className="lg lg--thread" /> thread</li>
          </ul>
        )}
        {!empty && selectedNode && !selected && (
          <div className="arc__anchor">
            <span className="plaque">{selectedNode.kind} · in the Observatory</span>
            <p className="display">{selectedNode.title}</p>
            <RouterLink to="/observatory" className="plaque">Open the Observatory →</RouterLink>
          </div>
        )}
      </div>

      <aside className="arc__panel">
        {selected ? (
          <ItemPanel item={selected} records={records} ops={ops} onBack={() => setSelectedId(null)} onSelect={setSelectedId} />
        ) : empty ? (
          <div className="panel">
            <header className="panel__head">
              <span className="plaque">How this room works</span>
              <h2 className="panel__title">A wall, some string</h2>
            </header>
            <ol className="guide">
              <li><strong>Capture</strong> anything in one line. Thoughts, ideas, links, memories.</li>
              <li><strong>Tag</strong> it. Items that share a tag gather around it on the wall.</li>
              <li><strong>Tie threads</strong> between things, in your own words: this supports that, this reminds me of that.</li>
            </ol>
            <p className="panel__empty">The wall never guesses at connections. Every line on it is one you drew.</p>
          </div>
        ) : (
          <ArchiveIndex
            records={records}
            query={query}
            onQuery={setQuery}
            tagFilter={tagFilter}
            onTagFilter={setTagFilter}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCapture={capture}
          />
        )}
      </aside>
    </section>
  );
}

export { isArchived };

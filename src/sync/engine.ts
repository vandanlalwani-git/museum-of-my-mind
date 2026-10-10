/**
 * One sync round, written so it can be tested without a browser or server:
 * pull what changed elsewhere, merge it (newest edit wins, per item), then
 * push what changed here. Deletions travel as ordinary edits, because nothing
 * is ever erased, only marked.
 */
import { SYNC_LIMITS, type SyncRequest, type SyncResponse } from '../../shared/sync-schema';
import { MIND_COLLECTIONS, type Mind, type MindCollection, type MindSnapshot } from '@/mind/types';
import { itemId, seal, unseal, type SyncKeys } from './keys';

export interface SyncState {
  mindId: string;
  /** The pairing code. Kept only on paired devices; never in backups, URLs or logs. */
  code: string;
  /** The highest server revision already merged here. */
  lastRev: number;
  /** The newest local edit already sent. */
  pushedThrough: number;
  lastSyncAt: number | null;
}

export interface Transport { send(req: SyncRequest, token: string): Promise<SyncResponse> }
export class SyncFailure extends Error { constructor(public reason: 'offline' | 'unpaired' | 'full' | 'error') { super(reason); } }

type Kind = MindCollection | 'mind';
interface Envelope { c: Kind; r: { id: string } & Record<string, unknown> }
export type Writes = Partial<{ [C in MindCollection]: MindSnapshot[C] }>;

const updatedOf = (c: Kind, r: Record<string, unknown>): number =>
  c === 'mind' ? Number(r.updatedAt ?? r.createdAt ?? 0) : Number(r.updatedAt ?? 1);
const key = (c: Kind, id: string) => `${c}:${id}`;

async function call(t: Transport, req: SyncRequest, token: string): Promise<Extract<SyncResponse, { ok: true }>> {
  let res: SyncResponse;
  try { res = await t.send(req, token); } catch { throw new SyncFailure('offline'); }
  if (res.ok) return res;
  if (res.error === 'unauthorized' || res.error === 'unknown_vault') throw new SyncFailure('unpaired');
  if (res.error === 'full') throw new SyncFailure('full');
  throw new SyncFailure('error');
}

/**
 * Everything that changed elsewhere since `since`, decrypted. A mailbox that
 * does not exist yet is empty only for a device that is creating it (`fresh`);
 * for anyone else it means the code is wrong or was replaced.
 */
export async function pullAll(keys: SyncKeys, since: number, t: Transport, fresh = false): Promise<{ items: Envelope[]; rev: number }> {
  const items: Envelope[] = [];
  let rev = since, more = true;
  while (more) {
    let res;
    try { res = await call(t, { op: 'pull', vault: keys.vault, since: rev }, keys.token); } catch (e) {
      if (fresh && e instanceof SyncFailure && e.reason === 'unpaired' && rev === 0) return { items, rev };
      throw e;
    }
    for (const it of res.items ?? []) {
      try { items.push(await unseal<Envelope>(keys.enc, it.blob)); } catch { /* a record this key cannot open is ignored, never trusted */ }
    }
    rev = Math.max(rev, res.rev);
    more = !!res.more;
  }
  return { items, rev };
}

/** Which incoming records are newer than what is here. Pure. */
export function mergeIncoming(snap: MindSnapshot, incoming: Envelope[]): { writes: Writes; mind: Mind | null; versions: Map<string, number> } {
  const writes: Writes = {};
  const versions = new Map<string, number>();
  let mind: Mind | null = null;
  const local = new Map<string, number>();
  for (const c of MIND_COLLECTIONS) for (const r of snap[c] as { id: string }[]) local.set(key(c, r.id), updatedOf(c, r as Record<string, unknown>));
  local.set(key('mind', snap.mind.id), updatedOf('mind', snap.mind as unknown as Record<string, unknown>));
  // If the same record arrives twice, keep the newest copy.
  const newest = new Map<string, Envelope>();
  for (const env of incoming) {
    if (!env || typeof env !== 'object' || !env.r || typeof env.r.id !== 'string') continue;
    if (env.c !== 'mind' && !MIND_COLLECTIONS.includes(env.c)) continue;
    const k = key(env.c, env.r.id), prev = newest.get(k);
    if (!prev || updatedOf(env.c, env.r) >= updatedOf(prev.c, prev.r)) newest.set(k, env);
  }
  for (const [k, env] of newest) {
    const u = updatedOf(env.c, env.r);
    if (local.has(k) && local.get(k)! >= u) continue;
    versions.set(k, u);
    if (env.c === 'mind') { mind = env.r as unknown as Mind; continue; }
    ((writes[env.c] ??= [] as never) as unknown[]).push(env.r);
  }
  return { writes, mind, versions };
}

export function applyWrites(snap: MindSnapshot, writes: Writes, mind: Mind | null): MindSnapshot {
  const out = { ...snap, ...(mind ? { mind } : {}) } as MindSnapshot;
  for (const c of MIND_COLLECTIONS) {
    const w = writes[c] as { id: string }[] | undefined;
    if (!w?.length) continue;
    const byId = new Map((snap[c] as { id: string }[]).map((r) => [r.id, r]));
    for (const r of w) byId.set(r.id, r);
    (out[c] as unknown[]) = [...byId.values()];
  }
  return out;
}

/** Sends every local record edited after `since`, skipping versions already sent or just received. */
export async function pushChanges(snap: MindSnapshot, since: number, keys: SyncKeys, t: Transport, echo: Map<string, number>): Promise<number> {
  const pending: { c: Kind; r: { id: string }; u: number }[] = [];
  const consider = (c: Kind, r: { id: string }) => {
    const u = updatedOf(c, r as unknown as Record<string, unknown>);
    if (u <= since) return;
    if (echo.get(key(c, r.id)) === u) return;
    pending.push({ c, r, u });
  };
  consider('mind', snap.mind);
  for (const c of MIND_COLLECTIONS) for (const r of snap[c] as { id: string }[]) consider(c, r);
  let newest = since;
  for (let i = 0; i < pending.length; i += SYNC_LIMITS.MAX_ITEMS_PER_PUSH) {
    const chunk = pending.slice(i, i + SYNC_LIMITS.MAX_ITEMS_PER_PUSH);
    const items = await Promise.all(chunk.map(async (p) => ({ id: await itemId(keys.ids, p.c, p.r.id), updated: p.u, blob: await seal(keys.enc, { c: p.c, r: p.r }) })));
    await call(t, { op: 'push', vault: keys.vault, items }, keys.token);
    for (const p of chunk) { newest = Math.max(newest, p.u); echo.set(key(p.c, p.r.id), p.u); }
  }
  return newest;
}

export interface RoundResult { writes: Writes; mind: Mind | null; state: SyncState; pulled: number; pushedUpTo: number }

/** Pull, merge, push. The caller writes `writes` and `mind` to storage. */
export async function syncRound(snap: MindSnapshot, state: SyncState, keys: SyncKeys, t: Transport, echo: Map<string, number>, now = Date.now()): Promise<RoundResult> {
  const { items, rev } = await pullAll(keys, state.lastRev, t, state.lastRev === 0 && state.pushedThrough === 0);
  const { writes, mind, versions } = mergeIncoming(snap, items);
  for (const [k, v] of versions) echo.set(k, v);
  const merged = applyWrites(snap, writes, mind);
  const pushedUpTo = await pushChanges(merged, state.pushedThrough, keys, t, echo);
  // Never let the watermark run ahead of the clock: a record stamped in the future
  // (a fast clock elsewhere, an import) must not hide later edits made here.
  return { writes, mind, pulled: items.length, pushedUpTo, state: { ...state, lastRev: rev, pushedThrough: Math.min(Math.max(state.pushedThrough, pushedUpTo), now), lastSyncAt: now } };
}

export const httpTransport: Transport = {
  async send(req, token) {
    const res = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sync-auth': token }, body: JSON.stringify(req), cache: 'no-store' });
    try { return (await res.json()) as SyncResponse; } catch { return { ok: false, error: 'unavailable' }; }
  },
};

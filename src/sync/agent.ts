/**
 * Runs sync for this device: turning it on, joining from another device,
 * and quiet background rounds. One round at a time; failures just wait for
 * the next chance. The pairing code lives only in this device's own storage.
 */
import { create } from 'zustand';
import { META_KEYS, metaRepo } from '@/data/repo/meta';
import { loadSnapshot, mindRepo, writeSnapshot } from '@/mind/repo';
import { useMind } from '@/mind/store';
import { MIND_COLLECTIONS, emptySnapshot, type Mind, type MindSnapshot } from '@/mind/types';
import { fromCode, newSecret, toCode } from './code';
import { httpTransport, mergeIncoming, pullAll, applyWrites, syncRound, SyncFailure, type SyncState, type Transport } from './engine';
import { deriveKeys, type SyncKeys } from './keys';

export type SyncProblem = null | 'offline' | 'unpaired' | 'full' | 'error';

interface SyncStatus {
  state: SyncState | null;
  busy: boolean;
  problem: SyncProblem;
  loaded: boolean;
}
export const useSync = create<SyncStatus>(() => ({ state: null, busy: false, problem: null, loaded: false }));

let transport: Transport = httpTransport;
export function setTransport(t: Transport) { transport = t; }

const echo = new Map<string, number>();
let keysFor: { code: string; keys: SyncKeys } | null = null;
let running: Promise<void> | null = null;

async function keysOf(code: string): Promise<SyncKeys> {
  if (keysFor?.code === code) return keysFor.keys;
  const secret = fromCode(code);
  if (!secret) throw new SyncFailure('error');
  const keys = await deriveKeys(secret);
  keysFor = { code, keys };
  return keys;
}

async function save(state: SyncState | null) {
  if (state) await metaRepo.set(META_KEYS.sync, state); else await metaRepo.remove(META_KEYS.sync);
  useSync.setState({ state });
}

export async function loadSync(): Promise<SyncState | null> {
  const state = (await metaRepo.get<SyncState>(META_KEYS.sync)) ?? null;
  useSync.setState({ state, loaded: true });
  return state;
}

/** One quiet round, if this device is paired and the paired museum is open. */
export function syncNow(): Promise<void> {
  if (running) return running;
  running = (async () => {
    const { state } = useSync.getState();
    const mindState = useMind.getState();
    if (!state || !mindState.snap || mindState.mind?.id !== state.mindId) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { useSync.setState({ problem: 'offline' }); return; }
    useSync.setState({ busy: true });
    try {
      const keys = await keysOf(state.code);
      const result = await syncRound(mindState.snap, state, keys, transport, echo);
      if (result.mind) await useMind.getState().applyMindRow(result.mind);
      for (const c of MIND_COLLECTIONS) {
        const w = result.writes[c];
        if (w?.length) await useMind.getState().put(c, w as never);
      }
      await save(result.state);
      useSync.setState({ problem: null });
    } catch (e) {
      useSync.setState({ problem: e instanceof SyncFailure ? e.reason : 'error' });
    } finally {
      useSync.setState({ busy: false });
    }
  })().finally(() => { running = null; });
  return running;
}

/** Turns sync on for the open museum and sends everything in it. Returns the pairing code to show other devices. */
export async function enableSync(): Promise<string> {
  const mind = useMind.getState().mind;
  if (!mind || mind.kind !== 'own') throw new Error('Open one of your own museums first.');
  const code = toCode(newSecret());
  await save({ mindId: mind.id, code, lastRev: 0, pushedThrough: 0, lastSyncAt: null });
  await syncNow();
  return code;
}

/** Brings a museum from another device onto this one, using its pairing code. */
export async function joinWithCode(input: string): Promise<Mind> {
  const secret = fromCode(input);
  if (!secret) throw new Error('That code does not look right. Check it and try again; letters and numbers only.');
  const code = toCode(secret);
  const keys = await deriveKeys(secret);
  let pulled;
  try { pulled = await pullAll(keys, 0, transport); } catch (e) {
    if (e instanceof SyncFailure && e.reason === 'unpaired') throw new Error('No museum uses this code. Check it on the other device, under Settings, Your devices.');
    throw new Error('The museum could not be reached. Check the connection and try again.');
  }
  const row = pulled.items.find((x) => x.c === 'mind')?.r as unknown as Mind | undefined;
  if (!row) throw new Error('No museum uses this code yet. On the other device, turn on sync first.');
  const existing = await mindRepo.get(row.id);
  const base: MindSnapshot = existing ? await loadSnapshot(existing) : emptySnapshot(row);
  const { writes, mind, versions } = mergeIncoming(base, pulled.items);
  for (const [k, v] of versions) echo.set(k, v);
  const merged = applyWrites(base, writes, mind ?? row);
  await writeSnapshot(merged);
  let newest = 0;
  for (const c of MIND_COLLECTIONS) for (const r of merged[c] as { updatedAt?: number }[]) newest = Math.max(newest, r.updatedAt ?? 0);
  await save({ mindId: row.id, code, lastRev: pulled.rev, pushedThrough: Math.min(newest, Date.now()), lastSyncAt: Date.now() });
  keysFor = { code, keys };
  await useMind.getState().reload();
  await useMind.getState().enter(row.id);
  useSync.setState({ problem: null });
  void syncNow();
  return merged.mind;
}

/** Stops syncing on this device. Everything stays here; other devices carry on. */
export async function stopSync(): Promise<void> {
  keysFor = null;
  echo.clear();
  await save(null);
  useSync.setState({ problem: null });
}

/**
 * For a lost or old device: empties the server mailbox and starts again with a
 * new code, so the old code opens nothing. Other devices join again with the new code.
 */
export async function replaceCode(): Promise<string> {
  const { state } = useSync.getState();
  if (state) {
    try { const keys = await keysOf(state.code); await transport.send({ op: 'forget', vault: keys.vault }, keys.token); } catch { /* an unreachable old mailbox simply stays locked */ }
  }
  keysFor = null;
  echo.clear();
  await save(null);
  return enableSync();
}

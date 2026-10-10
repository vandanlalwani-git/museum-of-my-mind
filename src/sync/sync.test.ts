import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeDB } from '@/data/db';
import { mindOps } from '@/mind/ops';
import { useMind } from '@/mind/store';
import { enableSync, joinWithCode, setTransport, stopSync, syncNow, useSync } from './agent';
import type { PulledItem, SyncRequest, SyncResponse } from '../../shared/sync-schema';
import { validateSyncRequest } from '../../shared/sync-schema';
import { buildDemoSnapshot } from '@/mind/demo';
import type { MindSnapshot } from '@/mind/types';
import { fromCode, newSecret, toCode, QR_PREFIX } from './code';
import { applyWrites, pullAll, syncRound, type SyncState, type Transport } from './engine';
import { deriveKeys, seal, unseal } from './keys';

/** The server's rules, in memory: claim on first push, newest edit wins, revisions only grow. */
function fakeServer() {
  const vaults = new Map<string, { auth: string; rev: number; items: Map<string, PulledItem> }>();
  const transport: Transport = {
    async send(raw: SyncRequest, token: string): Promise<SyncResponse> {
      const req = validateSyncRequest(JSON.parse(JSON.stringify(raw)));
      if (!req) return { ok: false, error: 'bad_request' };
      const v = vaults.get(req.vault);
      if (v && v.auth !== token) return { ok: false, error: 'unauthorized' };
      if (req.op === 'forget') { vaults.delete(req.vault); return { ok: true, rev: 0 }; }
      if (req.op === 'pull') {
        if (!v) return { ok: false, error: 'unknown_vault' };
        const items = [...v.items.values()].filter((i) => i.rev > req.since).sort((a, b) => a.rev - b.rev);
        const page = items.slice(0, 3);
        return { ok: true, rev: page.length ? page[page.length - 1]!.rev : req.since, items: page, more: items.length > 3 };
      }
      const vault = v ?? { auth: token, rev: 0, items: new Map() };
      vaults.set(req.vault, vault);
      for (const it of req.items) {
        const rev = ++vault.rev;
        const old = vault.items.get(it.id);
        if (!old || it.updated >= old.updated) vault.items.set(it.id, { ...it, rev });
      }
      return { ok: true, rev: vault.rev };
    },
  };
  return { vaults, transport };
}

async function device(snap: MindSnapshot, code: string, server: ReturnType<typeof fakeServer>) {
  const keys = await deriveKeys(fromCode(code)!);
  let state: SyncState = { mindId: snap.mind.id, code, lastRev: 0, pushedThrough: 0, lastSyncAt: null };
  const echo = new Map<string, number>();
  const d = {
    snap,
    async round(now = Date.now()) {
      const r = await syncRound(d.snap, state, keys, server.transport, echo, now);
      d.snap = applyWrites(d.snap, r.writes, r.mind);
      state = r.state;
      return r;
    },
  };
  return d;
}

const T = new Date(2026, 9, 11, 9).getTime();

describe('the pairing code', () => {
  it('round-trips, forgives typing, and catches a wrong character', () => {
    const secret = newSecret();
    const code = toCode(secret);
    expect(code).toMatch(/^([0-9A-Z]{4}-){6}[0-9A-Z]{3}$/);
    expect(fromCode(code)).toEqual(secret);
    expect(fromCode(code.toLowerCase().replace(/-/g, ' '))).toEqual(secret);
    expect(fromCode(QR_PREFIX + code.replace(/-/g, ''))).toEqual(secret);
    const flipped = code.replace(/^(.)/, (c) => (c === 'A' ? 'B' : 'A'));
    expect(fromCode(flipped)).toBeNull();
    expect(fromCode('hello')).toBeNull();
  });
});

describe('keys and sealing', () => {
  it('the same code gives the same mailbox; contents cannot be read or altered without the key', async () => {
    const s = newSecret();
    const a = await deriveKeys(s), b = await deriveKeys(s), c = await deriveKeys(newSecret());
    expect(a.vault).toBe(b.vault);
    expect(a.token).toBe(b.token);
    expect(a.vault).not.toBe(c.vault);
    const blob = await seal(a.enc, { title: 'Learn the guitar' });
    expect(blob).not.toContain('guitar');
    expect(await unseal(b.enc, blob)).toEqual({ title: 'Learn the guitar' });
    await expect(unseal(c.enc, blob)).rejects.toBeTruthy();
    const tampered = blob.slice(0, -4) + (blob.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    await expect(unseal(a.enc, tampered)).rejects.toBeTruthy();
  });
});

describe('two devices', () => {
  it('a new device receives everything; edits and deletions travel both ways; the newest edit wins', async () => {
    const server = fakeServer();
    const code = toCode(newSecret());
    const original = buildDemoSnapshot(T);
    const mac = await device(original, code, server);
    const first = await mac.round(T);
    expect(first.pulled).toBe(0);

    // The server holds only scrambled data.
    const stored = [...server.vaults.values()][0]!;
    expect(stored.items.size).toBeGreaterThan(40);
    expect(JSON.stringify([...stored.items.values()])).not.toContain('budget');

    // A phone joins with nothing and receives the whole museum.
    const keys = await deriveKeys(fromCode(code)!);
    const pulled = await pullAll(keys, 0, server.transport);
    expect(pulled.items.filter((i) => i.c === 'goals')).toHaveLength(original.goals.length);
    const phone = await device({ ...original, goals: [], projects: [], steps: [], thoughts: [], journal: [], reviews: [], galaxies: [] }, code, server);
    await phone.round(T + 1);
    expect(phone.snap.goals.map((g) => g.id).sort()).toEqual(original.goals.map((g) => g.id).sort());

    // The phone renames a goal and lets a thought go; the Mac edits a different field of the same goal later.
    const g = phone.snap.goals[0]!, t = phone.snap.thoughts[0]!;
    phone.snap = { ...phone.snap, goals: phone.snap.goals.map((x) => (x.id === g.id ? { ...x, title: 'Renamed on the phone', updatedAt: T + 10 } : x)), thoughts: phone.snap.thoughts.map((x) => (x.id === t.id ? { ...x, deletedAt: T + 11, updatedAt: T + 11 } : x)) };
    await phone.round(T + 12);
    await mac.round(T + 13);
    expect(mac.snap.goals.find((x) => x.id === g.id)?.title).toBe('Renamed on the phone');
    expect(mac.snap.thoughts.find((x) => x.id === t.id)?.deletedAt).toBe(T + 11);

    mac.snap = { ...mac.snap, goals: mac.snap.goals.map((x) => (x.id === g.id ? { ...x, why: 'Later, on the Mac', updatedAt: T + 20 } : x)) };
    phone.snap = { ...phone.snap, goals: phone.snap.goals.map((x) => (x.id === g.id ? { ...x, why: 'Earlier, on the phone', updatedAt: T + 15 } : x)) };
    await phone.round(T + 21);
    await mac.round(T + 22);
    await phone.round(T + 23);
    expect(mac.snap.goals.find((x) => x.id === g.id)?.why).toBe('Later, on the Mac');
    expect(phone.snap.goals.find((x) => x.id === g.id)?.why).toBe('Later, on the Mac');
  });

  it('a round with nothing new sends nothing, and a forgotten mailbox locks old devices out', async () => {
    const server = fakeServer();
    const code = toCode(newSecret());
    const mac = await device(buildDemoSnapshot(T), code, server);
    await mac.round(T);
    const before = [...server.vaults.values()][0]!.rev;
    await mac.round(T + 1);
    expect([...server.vaults.values()][0]!.rev).toBe(before);
    const keys = await deriveKeys(fromCode(code)!);
    await server.transport.send({ op: 'forget', vault: keys.vault }, keys.token);
    await expect(pullAll(keys, 0, server.transport)).rejects.toMatchObject({ reason: 'unpaired' });
  });

  it('the server refuses requests that break the rules', () => {
    expect(validateSyncRequest({ op: 'push', vault: 'short', items: [] })).toBeNull();
    expect(validateSyncRequest({ op: 'pull', vault: 'a'.repeat(22), since: -1 })).toBeNull();
    expect(validateSyncRequest({ op: 'push', vault: 'a'.repeat(22), items: [{ id: 'b'.repeat(22), updated: 1, blob: '<script>' }] })).toBeNull();
    expect(validateSyncRequest({ op: 'pull', vault: 'a'.repeat(22), since: 3 })).toEqual({ op: 'pull', vault: 'a'.repeat(22), since: 3 });
  });
});

describe('the sync agent on this device', () => {
  beforeEach(async () => {
    await closeDB();
    globalThis.indexedDB = new IDBFactory();
    useMind.setState({ status: 'idle', minds: [], mind: null, snap: null, movedIn: null });
    useSync.setState({ state: null, busy: false, problem: null, loaded: false });
    await stopSync();
  });

  it('turns on, keeps syncing after every round, and lets a second device join', async () => {
    const server = fakeServer();
    setTransport(server.transport);
    await useMind.getState().boot();
    await useMind.getState().createMind({ name: 'Mine', galaxyName: 'Personal' });
    const gx = useMind.getState().snap!.galaxies[0]!;
    await mindOps.addGoal({ galaxyId: gx.id, title: 'Learn the guitar' });
    const code = await enableSync();
    const vault = () => [...server.vaults.values()][0]!;
    const afterFirst = vault().items.size;
    expect(afterFirst).toBeGreaterThanOrEqual(3); // the museum, its galaxy, the goal
    expect(useSync.getState().state?.lastSyncAt).not.toBeNull();

    await mindOps.addThought({ text: 'A class on Saturdays?', galaxyId: gx.id });
    await syncNow();
    expect(vault().items.size).toBe(afterFirst + 1);

    // A second device: a fresh browser that joins with the code.
    await closeDB();
    globalThis.indexedDB = new IDBFactory();
    useMind.setState({ status: 'idle', minds: [], mind: null, snap: null, movedIn: null });
    await stopSync();
    await useMind.getState().boot();
    const joined = await joinWithCode(code.toLowerCase());
    expect(joined.name).toBe('Mine');
    expect(useMind.getState().snap!.goals.map((g) => g.title)).toEqual(['Learn the guitar']);
    expect(useMind.getState().snap!.thoughts.map((t) => t.text)).toEqual(['A class on Saturdays?']);
    await expect(joinWithCode('not a code')).rejects.toThrow('does not look right');
  });
});

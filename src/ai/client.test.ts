import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { reflect } from './client';
import { clearSessionKey, hasSessionKey, setSessionKey } from './session';
import { closeDB } from '@/data/db';
import { exportBackup, serializeBackup } from '@/data/backup';
import { ensureDemoSeeded } from '@/data/seed';
import { getDB } from '@/data/db';

const KEY = 'sk-ant-test-0123456789abcdefghijklmnop';
const req = { mode: 'themes' as const, model: 'claude-sonnet-5', items: [{ id: 'n-1', kind: 'note' as const, title: 'T', body: 'B', tags: [] }] };
const good = { ok: true, model: 'claude-sonnet-5', usage: { input: 1, output: 1 }, result: { themes: ['t'], tags: [], threads: [], projects: [], actions: [], reasoning: 'r', reflection: 'Hello.' } };
const respond = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

beforeEach(() => { setSessionKey(KEY); });
afterEach(() => { clearSessionKey(); vi.restoreAllMocks(); });

describe('reflect client', () => {
  it('sends the key only as a header to the same-origin relay and validates the reply', async () => {
    const f = respond(good);
    const out = await reflect(req, undefined, f as unknown as typeof fetch);
    expect(out.ok).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/reflect');
    expect((init.headers as Record<string, string>)['x-museum-key']).toBe(KEY);
    expect(String(init.body)).not.toContain(KEY);
  });

  it('maps failures to short codes', async () => {
    expect(await reflect(req, undefined, respond({ ok: false, error: 'invalid_key' }, 401) as unknown as typeof fetch)).toEqual({ ok: false, error: 'invalid_key' });
    expect(await reflect(req, undefined, respond({ ok: true, result: { nonsense: 1 } }) as unknown as typeof fetch)).toEqual({ ok: false, error: 'malformed' });
    expect(await reflect(req, undefined, (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch)).toEqual({ ok: false, error: 'network' });
    expect(await reflect(req, undefined, (async () => new Response('<html>not found</html>', { status: 404 })) as unknown as typeof fetch)).toEqual({ ok: false, error: 'unavailable' });
    const ctrl = new AbortController(); ctrl.abort();
    expect(await reflect(req, ctrl.signal, (async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }) as unknown as typeof fetch)).toEqual({ ok: false, error: 'cancelled' });
    clearSessionKey();
    expect(await reflect(req, undefined, respond(good) as unknown as typeof fetch)).toEqual({ ok: false, error: 'invalid_key' });
  });

  it('never lets the key reach storage or a backup', async () => {
    await closeDB();
    globalThis.indexedDB = new IDBFactory();
    await ensureDemoSeeded();
    expect(hasSessionKey()).toBe(true);
    const backup = serializeBackup(await exportBackup());
    expect(backup).not.toContain(KEY);
    const db = await getDB();
    const meta = await db.getAll('meta');
    expect(JSON.stringify(meta)).not.toContain(KEY);
    expect(typeof localStorage !== 'undefined' && JSON.stringify(localStorage).includes(KEY)).toBe(false);
  });
});

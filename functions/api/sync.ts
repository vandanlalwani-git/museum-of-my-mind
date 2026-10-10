import { AUTH_HEADER, SYNC_LIMITS, validToken, validateSyncRequest, type PulledItem, type SyncError, type SyncResponse } from '../../shared/sync-schema';
import { originAllowed } from '../../shared/origin';

/**
 * POST /api/sync: an encrypted mailbox for one person's paired devices.
 *
 * It stores scrambled records it cannot read, keyed by a random vault id.
 * The first device to write to a vault claims it with a token; only a hash of
 * that token is kept. Nothing is logged. Last write wins per record, by the
 * record's own timestamp.
 */

interface D1Prepared { bind(...values: unknown[]): D1Prepared; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<unknown> }
interface D1Database { prepare(query: string): D1Prepared; batch(statements: D1Prepared[]): Promise<unknown[]> }
interface Ctx { request: Request; env: { SYNC_DB?: D1Database } }

const json = (body: SyncResponse, status = 200): Response => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' },
});
const fail = (error: SyncError, status: number) => json({ ok: false, error }, status);

async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!originAllowed(request)) return fail('forbidden_origin', 403);
  const db = env.SYNC_DB;
  if (!db) return fail('unavailable', 503);
  if (!(request.headers.get('Content-Type') ?? '').includes('application/json')) return fail('bad_request', 400);
  const token = request.headers.get(AUTH_HEADER);
  if (!validToken(token)) return fail('unauthorized', 401);
  if (Number(request.headers.get('Content-Length') ?? '0') > SYNC_LIMITS.MAX_BODY_BYTES) return fail('bad_request', 413);
  const raw = await request.text();
  if (raw.length > SYNC_LIMITS.MAX_BODY_BYTES) return fail('bad_request', 413);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return fail('bad_request', 400); }
  const req = validateSyncRequest(parsed);
  if (!req) return fail('bad_request', 400);

  try {
    const auth = await sha256(token);
    const now = Date.now();
    const vault = await db.prepare('SELECT auth, rev, bytes FROM vaults WHERE id = ?').bind(req.vault).first<{ auth: string; rev: number; bytes: number }>();
    if (vault && !sameHash(vault.auth, auth)) return fail('unauthorized', 401);

    if (req.op === 'forget') {
      if (vault) await db.prepare('DELETE FROM vaults WHERE id = ?').bind(req.vault).run();
      return json({ ok: true, rev: 0 });
    }

    if (req.op === 'pull') {
      if (!vault) return fail('unknown_vault', 404);
      const { results } = await db.prepare('SELECT id, updated, rev, blob FROM items WHERE vault = ? AND rev > ? ORDER BY rev LIMIT ?')
        .bind(req.vault, req.since, SYNC_LIMITS.PULL_PAGE).all<PulledItem>();
      const last = results[results.length - 1];
      return json({ ok: true, rev: last ? last.rev : req.since, items: results, more: results.length === SYNC_LIMITS.PULL_PAGE });
    }

    // push: the first push claims a new vault.
    if (!vault) await db.prepare('INSERT INTO vaults (id, auth, rev, bytes, created, seen) VALUES (?, ?, 0, 0, ?, ?)').bind(req.vault, auth, now, now).run();
    else if (vault.bytes > SYNC_LIMITS.MAX_VAULT_BYTES) return fail('full', 413);
    const n = req.items.length;
    // One transaction: reserve n revisions, then write each item under its own revision.
    // An older copy never overwrites a newer one.
    const statements = [
      db.prepare('UPDATE vaults SET rev = rev + ?, seen = ? WHERE id = ?').bind(n, now, req.vault),
      ...req.items.map((it, i) => db.prepare(
        `INSERT INTO items (vault, id, updated, rev, blob) VALUES (?1, ?2, ?3, (SELECT rev FROM vaults WHERE id = ?1) - ?4, ?5)
         ON CONFLICT (vault, id) DO UPDATE SET updated = excluded.updated, rev = excluded.rev, blob = excluded.blob
         WHERE excluded.updated >= items.updated`,
      ).bind(req.vault, it.id, it.updated, n - 1 - i, it.blob)),
    ];
    await db.batch(statements);
    const after = await db.prepare('SELECT rev FROM vaults WHERE id = ?').bind(req.vault).first<{ rev: number }>();
    return json({ ok: true, rev: after?.rev ?? 0 });
  } catch {
    return fail('unavailable', 503);
  }
}

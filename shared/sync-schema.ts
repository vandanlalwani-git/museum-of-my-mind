/**
 * The contract between the museum and its sync function. Shared by the
 * browser and the Cloudflare Pages Function. Everything the server sees is
 * either random (vault and item ids), a hash, a timestamp, or ciphertext.
 */

export const SYNC_LIMITS = {
  MAX_ITEMS_PER_PUSH: 150,
  MAX_BLOB_CHARS: 64_000,
  MAX_BODY_BYTES: 2_000_000,
  MAX_VAULT_BYTES: 50_000_000,
  PULL_PAGE: 400,
} as const;

export const AUTH_HEADER = 'x-sync-auth';

export interface SyncItem { id: string; updated: number; blob: string }
export interface PulledItem extends SyncItem { rev: number }

export type SyncRequest =
  | { op: 'push'; vault: string; items: SyncItem[] }
  | { op: 'pull'; vault: string; since: number }
  | { op: 'forget'; vault: string };

export type SyncError = 'bad_request' | 'forbidden_origin' | 'unauthorized' | 'unknown_vault' | 'full' | 'unavailable';

export type SyncResponse =
  | { ok: true; rev: number; items?: PulledItem[]; more?: boolean }
  | { ok: false; error: SyncError };

const ID = /^[A-Za-z0-9_-]{16,64}$/;
const TOKEN = /^[A-Za-z0-9_-]{40,64}$/;

export const validToken = (t: string | null): t is string => !!t && TOKEN.test(t);

/** Returns null when the request is not acceptable. */
export function validateSyncRequest(x: unknown): SyncRequest | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.vault !== 'string' || !ID.test(o.vault)) return null;
  if (o.op === 'pull') {
    const since = Number(o.since);
    return Number.isInteger(since) && since >= 0 ? { op: 'pull', vault: o.vault, since } : null;
  }
  if (o.op === 'forget') return { op: 'forget', vault: o.vault };
  if (o.op !== 'push' || !Array.isArray(o.items) || o.items.length === 0 || o.items.length > SYNC_LIMITS.MAX_ITEMS_PER_PUSH) return null;
  const items: SyncItem[] = [];
  const seen = new Set<string>();
  for (const raw of o.items) {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || !ID.test(r.id) || seen.has(r.id)) return null;
    if (typeof r.updated !== 'number' || !Number.isFinite(r.updated) || r.updated < 0) return null;
    if (typeof r.blob !== 'string' || r.blob.length === 0 || r.blob.length > SYNC_LIMITS.MAX_BLOB_CHARS || !/^[A-Za-z0-9+/=_-]+$/.test(r.blob)) return null;
    seen.add(r.id);
    items.push({ id: r.id, updated: Math.floor(r.updated), blob: r.blob });
  }
  return { op: 'push', vault: o.vault, items };
}

/**
 * Everything is derived on the device from the pairing secret:
 * - vault: a random-looking mailbox name for the server;
 * - token: proves to the server that this device belongs to that mailbox (only its hash is stored);
 * - enc: the AES-GCM key that scrambles every record before it leaves;
 * - ids: hides even the records' ids from the server.
 * The secret itself never leaves the paired devices.
 */
export interface SyncKeys { vault: string; token: string; enc: CryptoKey; ids: CryptoKey }

const te = new TextEncoder();
const SALT = te.encode('museum-of-my-mind/sync/v1');

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function deriveKeys(secret: Uint8Array): Promise<SyncKeys> {
  const base = await crypto.subtle.importKey('raw', secret as BufferSource, 'HKDF', false, ['deriveBits', 'deriveKey']);
  const params = (info: string): HkdfParams => ({ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: te.encode(info) });
  const bits = (info: string, n: number) => crypto.subtle.deriveBits(params(info), base, n);
  const [vault, token, enc, ids] = await Promise.all([
    bits('vault', 128),
    bits('token', 256),
    crypto.subtle.deriveKey(params('enc'), base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']),
    crypto.subtle.deriveKey(params('ids'), base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']),
  ]);
  return { vault: b64url(vault), token: b64url(token), enc, ids };
}

/** Scrambles a value: a fresh 12-byte nonce, then AES-GCM ciphertext (which also detects tampering). */
export async function seal(enc: CryptoKey, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, enc, te.encode(JSON.stringify(value)));
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv); out.set(new Uint8Array(ct), 12);
  return b64url(out);
}

export async function unseal<T>(enc: CryptoKey, blob: string): Promise<T> {
  const bytes = fromB64url(blob);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, enc, bytes.slice(12));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

export async function itemId(ids: CryptoKey, collection: string, id: string): Promise<string> {
  return b64url(await crypto.subtle.sign('HMAC', ids, te.encode(`${collection}:${id}`))).slice(0, 32);
}

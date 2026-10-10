/**
 * The pairing code: 128 random bits written as 26 Crockford base32 characters
 * plus one check character, in groups of four. Forgiving to type: case,
 * spaces and dashes are ignored, and I, L and O read as 1, 1 and 0.
 */
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const QR_PREFIX = 'museum-sync:1:';

export function newSecret(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export function toCode(secret: Uint8Array): string {
  let bits = 0, value = 0, out = '';
  for (const byte of secret) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += ALPHA[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHA[(value << (5 - bits)) & 31];
  out += ALPHA[checksum(out)];
  return out.match(/.{1,4}/g)!.join('-');
}

function checksum(chars: string): number {
  let sum = 0;
  for (let i = 0; i < chars.length; i++) sum = (sum + ALPHA.indexOf(chars[i]!) * (i + 1)) % 32;
  return sum;
}

/** Reads a typed or scanned code. Returns null if it is not a valid pairing code. */
export function fromCode(input: string): Uint8Array | null {
  let s = input.trim();
  if (s.toLowerCase().startsWith(QR_PREFIX)) s = s.slice(QR_PREFIX.length);
  s = s.toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  if (s.length !== 27 || [...s].some((c) => !ALPHA.includes(c))) return null;
  const body = s.slice(0, 26);
  if (ALPHA[checksum(body)] !== s[26]) return null;
  const out = new Uint8Array(16);
  let bits = 0, value = 0, i = 0;
  for (const c of body) {
    value = (value << 5) | ALPHA.indexOf(c); bits += 5;
    if (bits >= 8) { if (i < 16) out[i++] = (value >>> (bits - 8)) & 255; bits -= 8; }
  }
  return i === 16 ? out : null;
}

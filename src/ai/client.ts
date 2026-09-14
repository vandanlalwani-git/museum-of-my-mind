import { LIMITS, validateResult, type ReflectError, type ReflectRequest, type ReflectResult } from '../../shared/reflect-schema';
import { takeSessionKey } from './session';

export type ReflectOutcome =
  | { ok: true; result: ReflectResult; model: string; usage: { input: number; output: number } }
  | { ok: false; error: ReflectError };

export const ERROR_TEXT: Record<ReflectError, string> = {
  bad_request: 'The relay did not accept that request. Nothing was sent to Anthropic.',
  too_large: 'That selection is too large for one request. Choose fewer items.',
  forbidden_origin: 'The relay only answers this site. Nothing was sent.',
  invalid_key: 'That key was not accepted by Anthropic. It has been forgotten; nothing was saved.',
  rate_limited: 'Anthropic asked us to slow down. Try again in a minute.',
  unavailable: 'The reflection relay is not available right now. The rest of the museum is unaffected.',
  upstream: 'Anthropic returned something unexpected. Nothing was saved.',
  malformed: 'The answer came back in a shape the museum could not use. Nothing was saved.',
  network: 'No connection to the relay. The museum works offline as before; reflection needs a connection.',
  cancelled: 'Cancelled before anything was sent.',
};

export function estimateBytes(req: ReflectRequest): number {
  return new TextEncoder().encode(JSON.stringify(req)).length;
}

/** Send one reflection request through the site's relay. The key travels in a header for this call only. */
export async function reflect(req: ReflectRequest, signal?: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<ReflectOutcome> {
  const key = takeSessionKey();
  if (!key) return { ok: false, error: 'invalid_key' };
  if (estimateBytes(req) > LIMITS.MAX_BODY_BYTES) return { ok: false, error: 'too_large' };
  let res: Response;
  try {
    res = await fetchImpl('/api/reflect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-museum-key': key },
      body: JSON.stringify(req),
      cache: 'no-store',
      ...(signal ? { signal } : {}),
    });
  } catch (e) {
    if ((e as { name?: string }).name === 'AbortError') return { ok: false, error: 'cancelled' };
    return { ok: false, error: 'network' };
  }
  let body: { ok?: boolean; error?: ReflectError; result?: unknown; model?: string; usage?: { input?: number; output?: number } };
  try { body = await res.json(); } catch { return { ok: false, error: res.status === 404 || res.status >= 500 ? 'unavailable' : 'malformed' }; }
  if (!body.ok) return { ok: false, error: body.error ?? (res.status === 404 ? 'unavailable' : 'upstream') };
  const result = validateResult(body.result, new Set(req.items.map((i) => i.id)));
  if (!result) return { ok: false, error: 'malformed' };
  return { ok: true, result, model: body.model ?? req.model, usage: { input: body.usage?.input ?? 0, output: body.usage?.output ?? 0 } };
}

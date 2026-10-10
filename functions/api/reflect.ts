import { originAllowed } from '../../shared/origin';
import { LIMITS, RESULT_TOOL, SYSTEM_PROMPT, buildUserMessage, validateRequest, validateResult, type ReflectError, type ReflectResponse } from '../../shared/reflect-schema';

/**
 * POST /api/reflect — the only server-side code in the museum.
 *
 * It relays one request to Anthropic using the key the person typed into
 * their own browser for this one call. It does not store, log, cache, or echo
 * the key or the content. Errors are reduced to a short code. Only this
 * app's origin (and localhost for development) may call it.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const KEY_HEADER = 'x-museum-key';

interface Ctx { request: Request; env?: { ANTHROPIC_URL?: string } }

const json = (body: ReflectResponse, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });

const fail = (error: ReflectError, status: number): Response => json({ ok: false, error }, status);

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!originAllowed(request)) return fail('forbidden_origin', 403);
  if (!(request.headers.get('Content-Type') ?? '').includes('application/json')) return fail('bad_request', 400);

  const key = request.headers.get(KEY_HEADER) ?? '';
  if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key)) return fail('invalid_key', 401);

  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > LIMITS.MAX_BODY_BYTES) return fail('too_large', 413);
  const raw = await request.text();
  if (raw.length > LIMITS.MAX_BODY_BYTES) return fail('too_large', 413);

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return fail('bad_request', 400); }
  const req = validateRequest(parsed);
  if (!req) return fail('bad_request', 400);

  let upstream: Response;
  try {
    upstream = await fetch(env?.ANTHROPIC_URL ?? ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: req.model,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        tools: [RESULT_TOOL],
        tool_choice: { type: 'tool', name: RESULT_TOOL.name },
        messages: [{ role: 'user', content: buildUserMessage(req) }],
      }),
    });
  } catch {
    return fail('unavailable', 502);
  }

  if (!upstream.ok) {
    const s = upstream.status;
    if (s === 401 || s === 403) return fail('invalid_key', 401);
    if (s === 429) return fail('rate_limited', 429);
    if (s === 400 || s === 413 || s === 422) return fail('bad_request', 400);
    if (s === 529 || s >= 500) return fail('unavailable', 502);
    return fail('upstream', 502);
  }

  let body: { model?: string; usage?: { input_tokens?: number; output_tokens?: number }; content?: { type: string; name?: string; input?: unknown }[] };
  try { body = await upstream.json(); } catch { return fail('malformed', 502); }
  const tool = body.content?.find((c) => c.type === 'tool_use' && c.name === RESULT_TOOL.name);
  const result = validateResult(tool?.input, new Set(req.items.map((i) => i.id)));
  if (!result) return fail('malformed', 502);

  return json({
    ok: true,
    result,
    model: typeof body.model === 'string' ? body.model : req.model,
    usage: { input: body.usage?.input_tokens ?? 0, output: body.usage?.output_tokens ?? 0 },
  });
}

/** Everything that is not a POST is refused, cheaply. */
export async function onRequest({ request }: Ctx): Promise<Response> {
  if (request.method === 'POST') return fail('bad_request', 400); // reached only if routing bypassed onRequestPost
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', Allow: 'POST' } });
  }
  return new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequest, onRequestPost } from '../functions/api/reflect';
import { originAllowed } from '../shared/origin';

const KEY = 'sk-ant-test-0123456789abcdefghijklmnop';
const goodBody = { mode: 'themes', model: 'claude-sonnet-5', items: [{ id: 'n-1', kind: 'note', title: 'T', body: 'B', tags: ['x'] }] };

function req(body: unknown, opts: { origin?: string; key?: string; method?: string; contentType?: string } = {}): Request {
  const headers: Record<string, string> = { 'Content-Type': opts.contentType ?? 'application/json' };
  if (opts.origin !== undefined) headers.Origin = opts.origin;
  if (opts.key !== undefined) headers['x-museum-key'] = opts.key;
  const method = opts.method ?? 'POST';
  return new Request('https://museum.pages.dev/api/reflect', { method, headers, ...(method === 'GET' || method === 'HEAD' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
}

const toolResponse = (input: unknown, status = 200) => new Response(JSON.stringify({ model: 'claude-sonnet-5', usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: 'tool_use', name: 'museum_reflection', input }] }), { status, headers: { 'content-type': 'application/json' } });

let logSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => { logSpy = vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe('origin policy', () => {
  it('allows the app origin and localhost only', () => {
    expect(originAllowed(req({}, { origin: 'https://museum.pages.dev' }))).toBe(true);
    expect(originAllowed(req({}, { origin: 'http://localhost:5173' }))).toBe(true);
    expect(originAllowed(req({}, { origin: 'https://evil.example' }))).toBe(false);
    expect(originAllowed(req({}, {}))).toBe(false);
  });
});

describe('POST /api/reflect', () => {
  it('refuses other methods and foreign origins without touching upstream', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect((await onRequest({ request: req({}, { method: 'GET', origin: 'https://museum.pages.dev' }) })).status).toBe(405);
    expect((await onRequestPost({ request: req(goodBody, { origin: 'https://evil.example', key: KEY }) })).status).toBe(403);
    expect((await onRequestPost({ request: req(goodBody, { origin: 'https://museum.pages.dev', key: 'nope' }) })).status).toBe(401);
    expect((await onRequestPost({ request: req('not json', { origin: 'https://museum.pages.dev', key: KEY }) })).status).toBe(400);
    expect((await onRequestPost({ request: req({ ...goodBody, items: [] }, { origin: 'https://museum.pages.dev', key: KEY }) })).status).toBe(400);
    const big = { ...goodBody, items: Array.from({ length: 40 }, (_, i) => ({ id: 'i' + i, kind: 'note', title: 'x'.repeat(200), body: 'y'.repeat(2000), tags: [] })) };
    expect((await onRequestPost({ request: req(big, { origin: 'https://museum.pages.dev', key: KEY }) })).status).toBe(413);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('relays a valid request, forwards the key only upstream, and returns validated data with no-store', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(toolResponse({
      themes: ['running'], tags: [{ itemId: 'n-1', tag: 'Health', why: 'w' }, { itemId: 'ghost', tag: 'x', why: '' }],
      threads: [], projects: [], actions: [{ text: 'Do it', why: 'because' }], reasoning: 'r', reflection: 'You keep coming back to running.',
    }));
    const res = await onRequestPost({ request: req(goodBody, { origin: 'https://museum.pages.dev', key: KEY }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toMatch(/no-store/);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.result.tags).toEqual([{ itemId: 'n-1', tag: 'health', why: 'w' }]);
    expect(body.result.reflection).toMatch(/running/);
    expect(JSON.stringify(body)).not.toContain(KEY);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toMatch(/api\.anthropic\.com/);
    expect((init!.headers as Record<string, string>)['x-api-key']).toBe(KEY);
    expect(String(init!.body)).toContain('quoted as data');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('reduces upstream failures to short codes and never echoes upstream text', async () => {
    const cases: [number, string][] = [[401, 'invalid_key'], [429, 'rate_limited'], [529, 'unavailable'], [400, 'bad_request'], [418, 'upstream']];
    for (const [status, code] of cases) {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{"error":{"message":"SECRET DETAIL"}}', { status }));
      const res = await onRequestPost({ request: req(goodBody, { origin: 'https://museum.pages.dev', key: KEY }) });
      const text = await res.text();
      expect(JSON.parse(text)).toEqual({ ok: false, error: code });
      expect(text).not.toContain('SECRET');
    }
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNRESET'));
    expect(await (await onRequestPost({ request: req(goodBody, { origin: 'https://museum.pages.dev', key: KEY }) })).json()).toEqual({ ok: false, error: 'unavailable' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(toolResponse({ nonsense: true }));
    expect(await (await onRequestPost({ request: req(goodBody, { origin: 'https://museum.pages.dev', key: KEY }) })).json()).toEqual({ ok: false, error: 'malformed' });
  });
});

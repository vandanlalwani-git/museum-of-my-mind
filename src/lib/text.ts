/** First line or sentence, trimmed to n characters, for titles and snippets. */
export function snippet(text: string, n = 90): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= n) return flat;
  const cut = flat.slice(0, n);
  const last = Math.max(cut.lastIndexOf(' '), n - 20);
  return cut.slice(0, last).trimEnd() + '…';
}

export function isUrl(s: string): boolean {
  return /^(https?:\/\/)[^\s]+$/i.test(s.trim());
}

/**
 * Turn a quickly typed thought into a title and body. A short single line
 * becomes the title; anything longer keeps its first line as the title and
 * the whole text as the body.
 */
export function splitCapture(raw: string): { title: string; body: string } {
  const text = raw.trim();
  const firstLine = text.split(/\r?\n/)[0]?.trim() ?? '';
  if (text.length <= 80 && !text.includes('\n')) return { title: text, body: '' };
  const title = snippet(firstLine || text, 72);
  return { title, body: text };
}

/** Normalise a tag typed by the keeper. */
export function normaliseTag(t: string): string {
  return t.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-').slice(0, 32);
}

export function parseTags(input: string): string[] {
  return [...new Set(input.split(/[,\s]+/).map(normaliseTag).filter(Boolean))];
}

/** Minimal safe rendering of a body: paragraphs on blank lines, line breaks otherwise. */
export function paragraphs(body: string): string[][] {
  return body.trim().split(/\n\s*\n/).map((p) => p.split(/\n/));
}

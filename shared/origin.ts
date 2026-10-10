/** Only this site (and localhost while developing) may call the museum's functions. */
export function originAllowed(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  let o: URL;
  try { o = new URL(origin); } catch { return false; }
  const self = new URL(request.url);
  if (o.host === self.host && o.protocol === self.protocol) return true;
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(o.host);
}

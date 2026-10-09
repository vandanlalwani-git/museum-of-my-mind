/**
 * Calendar days in the keeper's local time. Weeks run Monday to Sunday, so
 * the Sunday review closes the week it belongs to.
 */
export const DAY_MS = 86_400_000;

const pad = (n: number): string => String(n).padStart(2, '0');

/** YYYY-MM-DD for the local day containing `at`. */
export function dayKey(at: number | Date): string {
  const d = typeof at === 'number' ? new Date(at) : at;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight at the start of the day containing `at`. */
export function startOfDay(at: number | Date): Date {
  const d = typeof at === 'number' ? new Date(at) : new Date(at.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  out.setDate(out.getDate() + n);
  return out;
}

/** Local midnight on the Monday of the week containing `at`. */
export function startOfWeek(at: number | Date): Date {
  const d = startOfDay(at);
  const shift = (d.getDay() + 6) % 7; // Monday → 0, Sunday → 6
  return addDays(d, -shift);
}

/** Whole calendar days from `a` to `b` (positive when b is later), immune to daylight-saving shifts. */
export function daysBetween(a: number | Date, b: number | Date): number {
  const da = startOfDay(a), db = startOfDay(b);
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((ub - ua) / DAY_MS);
}

/** Parses YYYY-MM-DD as a local date. Returns null for anything else. */
export function parseDayKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dayKey(d) === key ? d : null;
}

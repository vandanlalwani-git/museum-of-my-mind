/**
 * Backup format version 4: whole minds with their galaxies.
 *
 * Older backups (versions 1 to 3, one record list per museum) still import:
 * they are checked by the old parser and then moved into the new model by
 * `migrateToMind`. A backup never carries keys of any kind.
 */
import { BACKUP_FORMAT, BackupError, parseBackup } from '@/data/backup';
import { migrateToMind, type MigrationOptions, type MigrationReport } from './migrate';
import { MIND_COLLECTIONS, type MindSnapshot } from './types';

export const MIND_BACKUP_SCHEMA_VERSION = 4;

export interface MindBackup {
  format: typeof BACKUP_FORMAT;
  schemaVersion: typeof MIND_BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  minds: MindSnapshot[];
}

export function makeMindBackup(minds: MindSnapshot[], now = Date.now()): MindBackup {
  return { format: BACKUP_FORMAT, schemaVersion: MIND_BACKUP_SCHEMA_VERSION, exportedAt: new Date(now).toISOString(), minds };
}

export function serializeMindBackup(b: MindBackup): string {
  return JSON.stringify(b, null, 2);
}

export type ParsedBackup =
  | { kind: 'mind'; backup: MindBackup; warnings: string[] }
  | { kind: 'legacy'; backup: MindBackup; warnings: string[]; report: MigrationReport };

const TOP_KEYS = new Set(['format', 'schemaVersion', 'exportedAt', 'minds']);
const MIND_KEYS = new Set(['mind', ...MIND_COLLECTIONS]);

/** Reads any museum backup, old or new. Structural problems throw; loose references only warn. */
export function parseAnyBackup(raw: string, opts: MigrationOptions = {}): ParsedBackup {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new BackupError('This file is not valid JSON.'); }
  if (!data || typeof data !== 'object') throw new BackupError('This file is not a museum backup.');
  const obj = data as Record<string, unknown>;
  if (obj.format !== BACKUP_FORMAT) throw new BackupError('This file is not a museum backup.');
  if (typeof obj.schemaVersion !== 'number') throw new BackupError('This file is not a museum backup.');

  if (obj.schemaVersion < MIND_BACKUP_SCHEMA_VERSION) {
    const legacy = parseBackup(raw);
    const { snapshot, report } = migrateToMind({ museums: legacy.museums, records: legacy.records }, opts);
    const backup = makeMindBackup(snapshot ? [snapshot] : [], opts.now);
    return { kind: 'legacy', backup, warnings: report.danglingReferences.map((d) => `Kept a link to something missing: ${d}`), report };
  }
  if (obj.schemaVersion > MIND_BACKUP_SCHEMA_VERSION) throw new BackupError('This backup was made by a newer version of the museum.');

  for (const k of Object.keys(obj)) if (!TOP_KEYS.has(k)) throw new BackupError(`Unexpected field "${k}" in backup.`);
  if (!Array.isArray(obj.minds)) throw new BackupError('Backup has no minds.');
  const warnings: string[] = [];
  const minds = (obj.minds as unknown[]).map((m, i) => checkMind(m, i, warnings));
  return { kind: 'mind', backup: { format: BACKUP_FORMAT, schemaVersion: MIND_BACKUP_SCHEMA_VERSION, exportedAt: String(obj.exportedAt ?? ''), minds }, warnings };
}

function checkMind(raw: unknown, index: number, warnings: string[]): MindSnapshot {
  const where = `mind ${index + 1}`;
  if (!raw || typeof raw !== 'object') throw new BackupError(`Backup ${where} is malformed.`);
  const m = raw as Record<string, unknown>;
  for (const k of Object.keys(m)) if (!MIND_KEYS.has(k)) throw new BackupError(`Unexpected field "${k}" in backup ${where}.`);
  const mind = m.mind as Record<string, unknown> | undefined;
  if (!mind || typeof mind.id !== 'string' || typeof mind.name !== 'string' || (mind.kind !== 'own' && mind.kind !== 'demo')) {
    throw new BackupError(`Backup ${where} has no museum details.`);
  }
  for (const c of MIND_COLLECTIONS) {
    const rows = m[c];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) throw new BackupError(`Backup field "${c}" is malformed.`);
    for (const row of rows as { id?: unknown; museumId?: unknown }[]) {
      if (!row || typeof row.id !== 'string') throw new BackupError(`A record in "${c}" has no id.`);
      if (row.museumId !== mind.id) throw new BackupError(`A record in "${c}" belongs to a museum not in this backup.`);
    }
  }
  const snap = {
    mind: m.mind,
    ...Object.fromEntries(MIND_COLLECTIONS.map((c) => [c, (m[c] as unknown[] | undefined) ?? []])),
  } as unknown as MindSnapshot;
  warnings.push(...danglingReferences(snap));
  return snap;
}

/** References that point at nothing in the same mind. Kept as they are, but worth knowing about. */
export function danglingReferences(s: MindSnapshot): string[] {
  const galaxies = new Set(s.galaxies.map((g) => g.id));
  const goals = new Set(s.goals.map((g) => g.id));
  const projects = new Set(s.projects.map((p) => p.id));
  const out: string[] = [];
  for (const g of s.goals) if (!galaxies.has(g.galaxyId)) out.push(`goal ${g.id} → galaxy ${g.galaxyId}`);
  for (const p of s.projects) {
    if (!galaxies.has(p.galaxyId)) out.push(`project ${p.id} → galaxy ${p.galaxyId}`);
    if (p.goalId !== null && !goals.has(p.goalId)) out.push(`project ${p.id} → goal ${p.goalId}`);
  }
  for (const st of s.steps) if (!projects.has(st.projectId)) out.push(`step ${st.id} → project ${st.projectId}`);
  for (const t of s.thoughts) {
    if (t.galaxyId !== null && !galaxies.has(t.galaxyId)) out.push(`thought ${t.id} → galaxy ${t.galaxyId}`);
    if (t.goalId !== undefined && !goals.has(t.goalId)) out.push(`thought ${t.id} → goal ${t.goalId}`);
    if (t.projectId !== undefined && !projects.has(t.projectId)) out.push(`thought ${t.id} → project ${t.projectId}`);
  }
  for (const e of s.journal) {
    if (e.goalId !== undefined && !goals.has(e.goalId)) out.push(`journal ${e.id} → goal ${e.goalId}`);
    if (e.projectId !== undefined && !projects.has(e.projectId)) out.push(`journal ${e.id} → project ${e.projectId}`);
  }
  return out.map((d) => `Kept a link to something missing: ${d}`);
}

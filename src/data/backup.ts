import { museumRepo } from '@/data/repo/museums';
import { clearMuseumRecords, loadMuseumRecords, writeMuseumRecords } from '@/data/repo/records';
import { RECORD_TYPES, emptyRecords, type Museum, type MuseumRecords, type RecordType } from '@/types';

export const BACKUP_FORMAT = 'museum-of-my-mind-backup';
export const BACKUP_SCHEMA_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  museums: Museum[];
  records: MuseumRecords;
}

export async function exportBackup(museumIds?: string[]): Promise<Backup> {
  const all = await museumRepo.list();
  const museums = museumIds ? all.filter((m) => museumIds.includes(m.id)) : all;
  const records = emptyRecords();
  for (const m of museums) {
    const r = await loadMuseumRecords(m.id);
    for (const t of RECORD_TYPES) (records[t] as unknown[]).push(...r[t]);
  }
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    museums,
    records,
  };
}

export function serializeBackup(b: Backup): string {
  return JSON.stringify(b, null, 2);
}

export class BackupError extends Error {}

const ALLOWED_TOP_KEYS = new Set(['format', 'schemaVersion', 'exportedAt', 'museums', 'records']);

export function parseBackup(raw: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new BackupError('This file is not valid JSON.');
  }
  if (!data || typeof data !== 'object') throw new BackupError('This file is not a museum backup.');
  const obj = data as Record<string, unknown>;
  for (const k of Object.keys(obj)) {
    if (!ALLOWED_TOP_KEYS.has(k)) throw new BackupError(`Unexpected field "${k}" in backup.`);
  }
  if (obj.format !== BACKUP_FORMAT) throw new BackupError('This file is not a museum backup.');
  if (typeof obj.schemaVersion !== 'number' || obj.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new BackupError('This backup was made by a newer version of the museum.');
  }
  if (!Array.isArray(obj.museums)) throw new BackupError('Backup has no museums.');
  const records = emptyRecords();
  const rec = (obj.records ?? {}) as Record<string, unknown>;
  for (const t of RECORD_TYPES) {
    const rows = rec[t];
    if (rows !== undefined && !Array.isArray(rows)) throw new BackupError(`Backup field "${t}" is malformed.`);
    (records[t] as unknown[]).push(...((rows as unknown[]) ?? []));
  }
  const museumIds = new Set((obj.museums as Museum[]).map((m) => m.id));
  for (const t of RECORD_TYPES) {
    for (const r of records[t] as { museumId?: string }[]) {
      if (!r.museumId || !museumIds.has(r.museumId)) {
        throw new BackupError(`A ${t.slice(0, -1)} record belongs to a museum not in this backup.`);
      }
    }
  }
  return {
    format: BACKUP_FORMAT,
    schemaVersion: obj.schemaVersion,
    exportedAt: String(obj.exportedAt ?? ''),
    museums: obj.museums as Museum[],
    records,
  };
}

export type ImportMode = 'merge' | 'replace';

export async function importBackup(backup: Backup, mode: ImportMode): Promise<{ museums: number; records: number }> {
  let count = 0;
  for (const m of backup.museums) {
    const existing = await museumRepo.get(m.id);
    if (mode === 'replace') {
      await clearMuseumRecords(m.id);
      await museumRepo.put(m);
    } else if (!existing) {
      await museumRepo.put(m);
    }
  }
  const toWrite = emptyRecords();
  for (const t of RECORD_TYPES) {
    for (const r of backup.records[t]) {
      if (mode === 'merge') {
        const exists = await (await import('@/data/db')).getDB().then((db) => db.getKey(t as RecordType, r.id));
        if (exists) continue;
      }
      (toWrite[t] as unknown[]).push(r);
      count++;
    }
  }
  await writeMuseumRecords(toWrite);
  return { museums: backup.museums.length, records: count };
}

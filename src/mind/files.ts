/**
 * Backups for the mind-first model: export everything, import any version,
 * and hand back the copy taken just before the switch-over.
 */
import { META_KEYS, metaRepo } from '@/data/repo/meta';
import { makeMindBackup, parseAnyBackup, serializeMindBackup } from './backup';
import { DEMO_MIND_ID } from './demo';
import { clearMind, loadSnapshot, mindRepo, writeSnapshot } from './repo';
import { MIND_COLLECTIONS, type MindSnapshot } from './types';

/** Every museum of the keeper's own (the demo is left out; it can always be reloaded). */
export async function exportAll(now = Date.now()): Promise<string> {
  const minds = (await mindRepo.list()).filter((m) => m.kind === 'own');
  const snaps = await Promise.all(minds.map((m) => loadSnapshot(m)));
  await metaRepo.set(META_KEYS.lastBackupAt, now);
  return serializeMindBackup(makeMindBackup(snaps, now));
}

export async function lastBackupAt(): Promise<number | null> {
  return (await metaRepo.get<number>(META_KEYS.lastBackupAt)) ?? null;
}

export type ImportMode = 'merge' | 'replace';
export interface ImportResult { minds: number; records: number; warnings: string[]; fromOlderVersion: boolean; firstMindId: string | null }

export async function importText(raw: string, mode: ImportMode): Promise<ImportResult> {
  const parsed = parseAnyBackup(raw);
  let minds = 0, records = 0;
  let firstMindId: string | null = null;
  for (const incoming of parsed.backup.minds) {
    if (incoming.mind.id === DEMO_MIND_ID) continue;
    const existing = await mindRepo.get(incoming.mind.id);
    let toWrite: MindSnapshot = incoming;
    if (existing && mode === 'replace') await clearMind(existing.id);
    else if (existing) {
      // Merge: keep everything already here; add only what is new.
      const here = await loadSnapshot(existing);
      toWrite = { ...incoming, mind: existing };
      for (const c of MIND_COLLECTIONS) {
        const ids = new Set((here[c] as { id: string }[]).map((r) => r.id));
        (toWrite[c] as unknown[]) = (incoming[c] as { id: string }[]).filter((r) => !ids.has(r.id));
      }
    }
    await writeSnapshot(toWrite);
    minds++;
    firstMindId ??= incoming.mind.id;
    for (const c of MIND_COLLECTIONS) records += toWrite[c].length;
  }
  return { minds, records, warnings: parsed.warnings, fromOlderVersion: parsed.kind === 'legacy', firstMindId };
}

/** The full copy of the old rooms taken just before the switch-over, if there was anything to copy. */
export async function preMoveBackup(): Promise<{ at: number; json: string } | null> {
  return (await metaRepo.get<{ at: number; json: string }>(META_KEYS.preMindBackup)) ?? null;
}

/**
 * The one-time move from the old rooms into the mind-first model.
 *
 * Order matters, because reverting code cannot undo stored data:
 * 1. A full version 3 backup is written to storage before anything else.
 * 2. The old stores are only read, never changed or deleted.
 * 3. The new stores are written in one transaction.
 * 4. Only then is the switch-over marked as done.
 */
import { exportBackup, serializeBackup } from '@/data/backup';
import { museumRepo } from '@/data/repo/museums';
import { META_KEYS, metaRepo } from '@/data/repo/meta';
import { migrateToMind, type MigrationReport } from './migrate';
import { writeSnapshot } from './repo';

export interface SwitchoverRecord { at: number; report: MigrationReport | null; mindId: string | null }

export async function runSwitchover(now = Date.now()): Promise<SwitchoverRecord | null> {
  const done = await metaRepo.get<SwitchoverRecord>(META_KEYS.mindSwitchover);
  if (done) return null;

  const museums = await museumRepo.list();
  const own = museums.filter((m) => m.kind === 'own');
  let record: SwitchoverRecord = { at: now, report: null, mindId: null };

  if (own.length) {
    const legacy = await exportBackup(own.map((m) => m.id));
    await metaRepo.set(META_KEYS.preMindBackup, { at: now, json: serializeBackup(legacy) });
    const { snapshot, report } = migrateToMind({ museums: legacy.museums, records: legacy.records }, { now });
    if (snapshot) {
      await writeSnapshot(snapshot);
      record = { at: now, report, mindId: snapshot.mind.id };
      await metaRepo.set(META_KEYS.movedInNote, report);
    }
  }

  // Whoever was inside a museum before keeps being inside: theirs, or the demo.
  const wasActive = await metaRepo.get<string>(META_KEYS.activeMuseumId);
  const activeOld = museums.find((m) => m.id === wasActive);
  if (activeOld?.kind === 'own' && record.mindId) await metaRepo.set(META_KEYS.activeMindId, record.mindId);
  else if (activeOld?.kind === 'demo') await metaRepo.set(META_KEYS.activeMindId, 'demo');

  await metaRepo.set(META_KEYS.mindSwitchover, record);
  return record;
}

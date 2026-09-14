import { museumRepo } from '@/data/repo/museums';
import { META_KEYS, metaRepo } from '@/data/repo/meta';
import { clearMuseumRecords, writeMuseumRecords } from '@/data/repo/records';
import { DEMO_MUSEUM_ID, demoMuseum, demoRecords } from './demo';

/**
 * Bump when the fictional demo content changes. The demo museum is re-seeded
 * on boot when the stored version is older, so it always shows the latest
 * fiction. Own museums are never touched by this.
 */
export const DEMO_SEED_VERSION = 3;

/** Seed or refresh the demo museum. Returns true if anything was written. */
export async function ensureDemoSeeded(): Promise<boolean> {
  const existing = await museumRepo.get(DEMO_MUSEUM_ID);
  const version = (await metaRepo.get<number>(META_KEYS.demoSeedVersion)) ?? 0;
  if (existing && version >= DEMO_SEED_VERSION) return false;
  if (existing) await clearMuseumRecords(DEMO_MUSEUM_ID);
  await museumRepo.put({ ...demoMuseum, lastEnteredAt: existing?.lastEnteredAt ?? Date.now() - 3 * 86_400_000 });
  await writeMuseumRecords(demoRecords);
  await metaRepo.set(META_KEYS.demoSeedVersion, DEMO_SEED_VERSION);
  return true;
}

/** Wipe and re-seed the demo museum. */
export async function resetDemo(): Promise<void> {
  await clearMuseumRecords(DEMO_MUSEUM_ID);
  await museumRepo.put({ ...demoMuseum, lastEnteredAt: Date.now() });
  await writeMuseumRecords(demoRecords);
  await metaRepo.set(META_KEYS.demoSeedVersion, DEMO_SEED_VERSION);
}

export { DEMO_MUSEUM_ID };

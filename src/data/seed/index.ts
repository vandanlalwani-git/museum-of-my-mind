import { museumRepo } from '@/data/repo/museums';
import { clearMuseumRecords, writeMuseumRecords } from '@/data/repo/records';
import { DEMO_MUSEUM_ID, demoMuseum, demoRecords } from './demo';

/** Seed the demo museum if it does not exist. Returns true if it was created. */
export async function ensureDemoSeeded(): Promise<boolean> {
  const existing = await museumRepo.get(DEMO_MUSEUM_ID);
  if (existing) return false;
  await museumRepo.put({ ...demoMuseum, lastEnteredAt: Date.now() - 3 * 86_400_000 });
  await writeMuseumRecords(demoRecords);
  return true;
}

/** Wipe and re-seed the demo museum. */
export async function resetDemo(): Promise<void> {
  await clearMuseumRecords(DEMO_MUSEUM_ID);
  await museumRepo.put({ ...demoMuseum, lastEnteredAt: Date.now() });
  await writeMuseumRecords(demoRecords);
}

export { DEMO_MUSEUM_ID };

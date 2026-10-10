/** Routes and the sky: which view a place asks for, and where "zoom out" goes. */
import type { MindSnapshot } from '@/mind/types';
import type { SkyView } from './engine';
import type { SkyMode } from './store';

export function viewForRoute(pathname: string, search: string, snap: MindSnapshot | null, mode: SkyMode): SkyView {
  if (!snap) return { level: 'rest' };
  const params = new URLSearchParams(search);
  const [, first, id] = pathname.split('/');
  if (pathname === '/') {
    if (mode === 'list') return { level: 'rest' };
    const goal = snap.goals.find((g) => g.id === params.get('goal'));
    if (goal) return { level: 'system', galaxyId: goal.galaxyId, goalId: goal.id };
    const galaxy = params.get('galaxy');
    if (galaxy && snap.galaxies.some((g) => g.id === galaxy)) return { level: 'galaxy', galaxyId: galaxy };
    return { level: 'mind' };
  }
  if (first === 'goal') {
    const goal = snap.goals.find((g) => g.id === id);
    return goal ? { level: 'page', galaxyId: goal.galaxyId, goalId: goal.id } : { level: 'rest' };
  }
  if (first === 'project') {
    const p = snap.projects.find((x) => x.id === id);
    if (!p) return { level: 'rest' };
    return p.goalId ? { level: 'project', galaxyId: p.galaxyId, goalId: p.goalId, projectId: p.id } : { level: 'galaxy', galaxyId: p.galaxyId };
  }
  return { level: 'rest' };
}

export function parentRoute(pathname: string, search: string, snap: MindSnapshot | null): string | null {
  if (!snap) return null;
  const params = new URLSearchParams(search);
  const [, first, id] = pathname.split('/');
  if (pathname === '/') {
    const goal = snap.goals.find((g) => g.id === params.get('goal'));
    if (goal) return `/?galaxy=${goal.galaxyId}`;
    if (params.get('galaxy')) return '/';
    return null;
  }
  if (first === 'goal') return `/?goal=${id}`;
  if (first === 'project') {
    const p = snap.projects.find((x) => x.id === id);
    return p?.goalId ? `/goal/${p.goalId}` : p ? `/?galaxy=${p.galaxyId}` : '/';
  }
  return null;
}

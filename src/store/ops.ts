import { useMemo } from 'react';
import { makeAction, makeGoal, makeProject, touched } from '@/data/factories';
import { useMuseumStore } from '@/store/museum';
import { useUiStore } from '@/store/ui';
import type { Action, Goal, GoalState, Horizon, Project, ProjectStatus } from '@/types';

/**
 * The one set of operations on goals, projects, and actions. Every room
 * (Observatory, Workshop, Cabinet) goes through here, so there is a single
 * source of truth for what each transition means and says.
 */
export interface MuseumOps {
  createGoal: (v: { title: string; why: string; horizon: Horizon }) => Promise<Goal>;
  updateGoal: (goal: Goal, patch: Partial<Goal>) => Promise<void>;
  setGoalState: (goal: Goal, state: GoalState) => Promise<void>;

  createProject: (input: { title: string; summary?: string; goalIds?: string[]; status?: ProjectStatus; tags?: string[] }) => Promise<Project>;
  updateProject: (project: Project, patch: Partial<Project>) => Promise<void>;
  setProjectStatus: (project: Project, status: ProjectStatus) => Promise<void>;
  /** Removes the project, its actions, and any threads touching it. */
  deleteProject: (project: Project) => Promise<void>;

  addAction: (projectId: string, text: string) => Promise<Action>;
  toggleAction: (action: Action) => Promise<void>;
  removeAction: (action: Action) => Promise<void>;
}

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  idea: 'An idea', active: 'In motion', paused: 'Resting', done: 'Finished', abandoned: 'Set aside',
};

export function useMuseumOps(): MuseumOps {
  const museumId = useMuseumStore((s) => s.activeMuseumId);
  const upsert = useMuseumStore((s) => s.upsert);
  const remove = useMuseumStore((s) => s.remove);
  const say = useUiStore((s) => s.say);

  return useMemo<MuseumOps>(() => {
    const id = () => { if (!museumId) throw new Error('No museum is open.'); return museumId; };
    const records = () => useMuseumStore.getState().records;
    return {
      async createGoal(v) {
        const g = makeGoal(id(), v);
        await upsert('goals', g);
        return g;
      },
      async updateGoal(goal, patch) { await upsert('goals', touched(goal, patch)); },
      async setGoalState(goal, state) {
        await upsert('goals', touched(goal, { state }));
        say(state === 'fulfilled' ? 'Fulfilled. It stays in the record, beneath the horizon.'
          : state === 'released' ? 'Released. You can call it back any time.'
          : state === 'dormant' ? 'Resting. It dims but does not leave the sky.'
          : 'Back in the sky.');
      },

      async createProject(input) {
        const p = makeProject(id(), { title: input.title, ...(input.summary !== undefined ? { summary: input.summary } : {}), goalIds: input.goalIds ?? [] });
        const withExtras: Project = { ...p, ...(input.status ? { status: input.status } : {}), ...(input.tags ? { tags: input.tags } : {}) };
        await upsert('projects', withExtras);
        return withExtras;
      },
      async updateProject(project, patch) { await upsert('projects', touched(project, patch)); },
      async setProjectStatus(project, status) {
        const patch: Partial<Project> = { status };
        if (status === 'done') patch.progress = 1;
        await upsert('projects', touched(project, patch));
        say(status === 'done' ? 'Finished. It turns green and settles.'
          : status === 'paused' ? 'Resting. Dust will gather, gently.'
          : status === 'abandoned' ? 'Set aside. It stays on the shelf, under a cloth.'
          : status === 'active' ? 'Back on the bench.'
          : 'Kept as an idea.');
      },
      async deleteProject(project) {
        const r = records();
        for (const a of r.actions) if (a.projectId === project.id) await remove('actions', a.id);
        for (const t of r.threads) if (t.fromId === project.id || t.toId === project.id) await remove('threads', t.id);
        await remove('projects', project.id);
        say('Let go.');
      },

      async addAction(projectId, text) {
        const a = makeAction(id(), projectId, text);
        await upsert('actions', a);
        const p = records().projects.find((x) => x.id === projectId);
        if (p) await upsert('projects', touched(p));
        return a;
      },
      async toggleAction(action) {
        const now = Date.now();
        if (action.doneAt) {
          const { doneAt: _done, ...rest } = action;
          await upsert('actions', { ...rest, updatedAt: now, lastVisitedAt: now });
        } else {
          await upsert('actions', touched(action, { doneAt: now }));
          say('Done. The next point lights.');
        }
        const p = records().projects.find((x) => x.id === action.projectId);
        if (p) await upsert('projects', touched(p));
      },
      async removeAction(action) { await remove('actions', action.id); },
    };
  }, [museumId, upsert, remove, say]);
}

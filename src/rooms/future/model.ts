import type { Action, Goal, Project } from '@/types';

/**
 * The Future Gallery's model. A thought experiment, not a forecast.
 *
 * Every number below is an assumption you can read, and the explanation
 * text states them. The model is deterministic: the same goal, projects,
 * and controls always draw the same twelve months.
 */

export interface Controls {
  hoursPerWeek: number; // 0..20
  consistency: number;  // 0..1
  focus: number;        // 0..1 (1 = one main project)
  rest: number;         // 0..1
  /** Typical project size in focused hours when a project has no size of its own. */
  projectHours?: number;
}

export const SIZE_OPTIONS = [
  { hours: 15, label: 'Small', hint: 'about 15 focused hours' },
  { hours: 40, label: 'Medium', hint: 'about 40 focused hours' },
  { hours: 100, label: 'Large', hint: 'about 100 focused hours' },
] as const;

export function sizeLabel(hours: number): string {
  const o = SIZE_OPTIONS.find((x) => x.hours === hours);
  return o ? `${o.label.toLowerCase()} (${o.hint})` : `about ${hours} focused hours`;
}

export const ASSUMPTIONS = {
  PROJECT_HOURS: 40,          // a typical project here takes about 40 focused hours from empty to done
  WEEKS_PER_MONTH: 4.33,
  RESTART_FLOOR: 0.35,        // even at zero consistency, some weeks still happen
  SWITCH_TAX_PER_PROJECT: 0.1,
  SWITCH_TAX_MAX: 0.4,
  IDEA_STARTUP_HOURS: 4,      // an idea costs a few hours before it shows progress
  NEXT_STEP_HEAD_START: 2,    // a named next step is worth a couple of hours of "getting going"
  MONTHS: 12,
} as const;

export interface ProjectOutlook {
  projectId: string;
  title: string;
  status: Project['status'];
  worked: boolean;
  /** Focused hours assumed for this project, and whether the keeper set it. */
  sizeHours: number;
  sizeSet: boolean;
  start: number;
  /** Progress at the end of each month, index 0 = now. */
  path: number[];
  finishMonth: number | null;
}

export interface Outlook {
  goalId: string;
  controls: Controls;
  workedCount: number;
  candidateCount: number;
  consistencyFactor: number;
  switchingTax: number;
  /** Sustainability at months 3, 6, 12 (1 = full energy). */
  sustain: [number, number, number];
  monthlyHoursTotal: number;
  /** Goal brightness at months 3, 6, 12, 0..1. */
  brightness: [number, number, number];
  projects: ProjectOutlook[];
}

export function candidateProjects(goal: Goal, projects: Project[]): Project[] {
  const order = { active: 0, paused: 1, idea: 2, done: 9, abandoned: 9 } as const;
  return projects
    .filter((p) => p.goalIds.includes(goal.id) && p.status !== 'done' && p.status !== 'abandoned')
    .sort((a, b) => order[a.status] - order[b.status] || b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}

export function clampControls(c: Controls): Controls {
  const f = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
  return { hoursPerWeek: f(c.hoursPerWeek, 0, 20), consistency: f(c.consistency, 0, 1), focus: f(c.focus, 0, 1), rest: f(c.rest, 0, 1), projectHours: f(c.projectHours ?? ASSUMPTIONS.PROJECT_HOURS, 5, 400) };
}

function sustainAt(rest: number, month: number): number {
  if (rest >= 0.5) return rest >= 0.75 ? 1.05 : 1;
  return Math.max(0.35, 1 - (0.5 - rest) * 2 * (month / ASSUMPTIONS.MONTHS));
}

export function simulate(goal: Goal, projects: Project[], actions: Action[], raw: Controls): Outlook {
  const controls = clampControls(raw);
  const A = ASSUMPTIONS;
  const candidates = candidateProjects(goal, projects);
  const n = candidates.length === 0 ? 0 : Math.max(1, Math.round(1 + (1 - controls.focus) * (candidates.length - 1)));
  const worked = new Set(candidates.slice(0, n).map((p) => p.id));
  const consistencyFactor = A.RESTART_FLOOR + (1 - A.RESTART_FLOOR) * controls.consistency;
  const switchingTax = Math.min(A.SWITCH_TAX_MAX, A.SWITCH_TAX_PER_PROJECT * Math.max(0, n - 1));
  const monthlyHoursTotal = controls.hoursPerWeek * A.WEEKS_PER_MONTH * consistencyFactor * (1 - switchingTax);

  const outlooks: ProjectOutlook[] = candidates.map((p) => {
    const isWorked = worked.has(p.id);
    const hasNext = actions.some((a) => a.projectId === p.id && !a.doneAt);
    const sizeHours = p.sizeHours ?? controls.projectHours ?? A.PROJECT_HOURS;
    let progress = p.progress;
    let startup = p.status === 'idea' ? A.IDEA_STARTUP_HOURS : 0;
    startup = Math.max(0, startup - (hasNext ? A.NEXT_STEP_HEAD_START : 0));
    const path: number[] = [progress];
    let finishMonth: number | null = null;
    for (let m = 1; m <= A.MONTHS; m++) {
      if (isWorked && n > 0) {
        let hours = (monthlyHoursTotal / n) * sustainAt(controls.rest, m);
        if (startup > 0) { const used = Math.min(startup, hours); startup -= used; hours -= used; }
        progress = Math.min(1, progress + hours / sizeHours);
        if (progress >= 1 && finishMonth === null) finishMonth = m;
      }
      path.push(progress);
    }
    return { projectId: p.id, title: p.title, status: p.status, worked: isWorked, sizeHours, sizeSet: p.sizeHours !== undefined, start: p.progress, path, finishMonth };
  });

  const brightnessAt = (m: number): number => {
    if (outlooks.length === 0) return 0.2 + 0.3 * controls.consistency;
    const mean = outlooks.reduce((s, o) => s + (o.path[m] ?? 0), 0) / outlooks.length;
    return Math.min(1, mean * 0.85 + 0.15 * controls.consistency);
  };

  return {
    goalId: goal.id,
    controls,
    workedCount: n,
    candidateCount: candidates.length,
    consistencyFactor,
    switchingTax,
    sustain: [sustainAt(controls.rest, 3), sustainAt(controls.rest, 6), sustainAt(controls.rest, 12)],
    monthlyHoursTotal,
    brightness: [brightnessAt(3), brightnessAt(6), brightnessAt(12)],
    projects: outlooks,
  };
}

/* ---------- plain-language explanation ---------- */

const roughly = (v: number): string => {
  if (v >= 0.98) return 'done';
  if (v >= 0.85) return 'nearly done';
  if (v >= 0.6) return 'well past halfway';
  if (v >= 0.4) return 'about halfway';
  if (v >= 0.2) return 'a good start';
  if (v > 0.02) return 'barely begun';
  return 'untouched';
};

export function explain(o: Outlook, goal: Goal): string[] {
  const c = o.controls;
  const lines: string[] = [];
  if (o.candidateCount === 0) {
    lines.push(`“${goal.title}” has no unfinished projects, so there is nothing for the hours to move. The goal stays as bright as your consistency keeps it.`);
    return lines;
  }
  const hrs = Math.round(o.monthlyHoursTotal);
  lines.push(
    `${c.hoursPerWeek} hour${c.hoursPerWeek === 1 ? '' : 's'} a week, kept up ${pct(c.consistency)} of the time, comes to about ${hrs} usable hour${hrs === 1 ? '' : 's'} a month` +
    (c.consistency < 0.6 ? '. Skipped weeks cost more than the hours they lose, because restarting is slow.' : '.'),
  );
  const typical = o.controls.projectHours ?? ASSUMPTIONS.PROJECT_HOURS;
  const sized = o.projects.filter((p) => p.sizeSet);
  lines.push(
    `A project is taken to be ${sizeLabel(typical)} unless you have sized it` +
    (sized.length ? `: ${sized.map((p) => `“${p.title}” is ${sizeLabel(p.sizeHours)}`).join('; ')}.` : '. None of these have a size of their own yet; set one in the Workshop and this changes.') +
    ' These are rough guesses, not measurements.',
  );
  if (o.workedCount === 1) {
    lines.push(`All of it goes to one project. Nothing is lost to switching.`);
  } else {
    lines.push(`It is split across ${o.workedCount} project${o.workedCount === 1 ? '' : 's'}, and about ${Math.round(o.switchingTax * 100)}% goes to switching between them. That is the trade: more things move, each more slowly.`);
  }
  if (c.rest < 0.5) {
    lines.push(`Rest is thin, so the pace holds for a while and then fades: by month twelve the same hours do about ${pct(o.sustain[2])} of the work they did in month one.`);
  } else if (c.rest >= 0.75) {
    lines.push(`Rest is protected. The pace holds all year, with a little to spare.`);
  } else {
    lines.push(`Rest is enough to hold the pace steady all year.`);
  }
  const finished = o.projects.filter((p) => p.finishMonth !== null).sort((a, b) => (a.finishMonth ?? 0) - (b.finishMonth ?? 0));
  const waiting = o.projects.filter((p) => !p.worked);
  if (finished.length) {
    lines.push(finished.map((p) => `“${p.title}” could be finished around month ${p.finishMonth}`).join('; ') + '.');
  }
  const moving = o.projects.filter((p) => p.worked && p.finishMonth === null);
  if (moving.length) {
    lines.push(moving.map((p) => `“${p.title}” would be ${roughly(p.path[12] ?? 0)} by month twelve`).join('; ') + '.');
  }
  if (waiting.length) {
    lines.push(`${waiting.map((p) => `“${p.title}”`).join(', ')} wait${waiting.length === 1 ? 's' : ''} in the meantime. Waiting is not failing.`);
  }
  return lines;
}

export function assumptionsText(controls?: Controls): string[] {
  const A = ASSUMPTIONS;
  const typical = controls?.projectHours ?? A.PROJECT_HOURS;
  return [
    `A project is assumed to take ${sizeLabel(typical)} from empty to done, unless it has its own rough size from the Workshop. Sizes are guesses you can change, never measurements.`,
    `Consistency scales usable hours from ${Math.round(A.RESTART_FLOOR * 100)}% (almost never) to 100% (every week).`,
    `Each extra project worked at once costs ${Math.round(A.SWITCH_TAX_PER_PROJECT * 100)}% in switching, up to ${Math.round(A.SWITCH_TAX_MAX * 100)}%.`,
    `Below half rest, the pace fades over the year; above three-quarters, it gains a little.`,
    `An idea costs about ${A.IDEA_STARTUP_HOURS} hours before it shows progress; a named next step gives back ${A.NEXT_STEP_HEAD_START}.`,
    `None of this knows anything about you beyond what is in your museum. It is a way of looking, not a prediction.`,
  ];
}

function pct(v: number): string { return `${Math.round(v * 100)}%`; }

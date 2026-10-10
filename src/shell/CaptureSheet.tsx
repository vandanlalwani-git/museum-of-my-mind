import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { mindOps } from '@/mind/ops';
import { useMind } from '@/mind/store';
import { motionReduced } from '@/lib/motion';
import { useUiStore } from '@/store/ui';
import { useSky } from '@/sky/store';
import type { MoteTarget } from '@/sky/engine';
import { useCapture, useFocus, type CaptureKind } from './focus';
import { HomePicker, type Target } from './HomePicker';
import './capture.css';

const KINDS: { id: CaptureKind; label: string }[] = [
  { id: 'thought', label: 'Thought' },
  { id: 'question', label: 'Question' },
  { id: 'step', label: 'Step' },
  { id: 'memory', label: 'Memory' },
];
const UNSORTED: Target = { kind: 'galaxy', id: '__unsorted', title: 'Unsorted' };

/** Write it down first, decide later. Opens over any screen; Unsorted is always the default. */
export function CaptureSheet() {
  const { open, preset, closeCapture } = useCapture();
  const snap = useMind((s) => s.snap);
  const focus = useFocus();
  const say = useUiStore((s) => s.say);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<CaptureKind>('thought');
  const [where, setWhere] = useState<Target>(UNSORTED);
  const [extra, setExtra] = useState<Target | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  // A closing sheet must never catch a tap, even while it fades (or if its fade stalls in a background tab).
  useEffect(() => {
    // Reopening quickly can revive the sheet that was still fading out, so lift the block again.
    for (const el of [formRef.current, scrimRef.current]) {
      if (open) el?.style.removeProperty('pointer-events');
      else el?.style.setProperty('pointer-events', 'none');
    }
  }, [open]);

  // Suggested places: what the keeper is looking at, then what they visited most recently.
  const chips = useMemo<Target[]>(() => {
    if (!snap) return [];
    const out: Target[] = [];
    const add = (t: Target | null) => { if (t && !out.some((x) => x.id === t.id)) out.push(t); };
    const goal = (id: string | null | undefined) => { const g = id ? snap.goals.find((x) => x.id === id && !x.deletedAt) : undefined; return g ? { kind: 'goal' as const, id: g.id, title: g.title } : null; };
    const project = (id: string | null | undefined) => { const p = id ? snap.projects.find((x) => x.id === id && !x.deletedAt) : undefined; return p ? { kind: 'project' as const, id: p.id, title: p.title } : null; };
    if (kind === 'step') {
      add(project(preset.projectId ?? focus.projectId));
      for (const p of [...snap.projects].filter((x) => !x.deletedAt && x.state === 'active').sort((a, b) => b.lastVisitedAt - a.lastVisitedAt).slice(0, 3)) add(project(p.id));
    } else {
      add(project(preset.projectId ?? focus.projectId));
      add(goal(preset.goalId ?? focus.goalId));
      for (const g of [...snap.goals].filter((x) => !x.deletedAt && x.state === 'active').sort((a, b) => b.lastVisitedAt - a.lastVisitedAt).slice(0, 3)) add(goal(g.id));
    }
    return out.slice(0, 4);
  }, [snap, kind, preset, focus.goalId, focus.projectId]);

  useEffect(() => {
    if (!open) return;
    setText(''); setError(''); setPicking(false); setExtra(null);
    setKind(preset.kind ?? 'thought');
    const p = preset.projectId ? snap?.projects.find((x) => x.id === preset.projectId) : undefined;
    const g = preset.goalId ? snap?.goals.find((x) => x.id === preset.goalId) : undefined;
    setWhere(p ? { kind: 'project', id: p.id, title: p.title } : g ? { kind: 'goal', id: g.id, title: g.title } : UNSORTED);
    const t = setTimeout(() => ref.current?.focus({ preventScroll: true }), 60);
    return () => clearTimeout(t);
  }, [open, preset, snap]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); closeCapture(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeCapture]);

  // A step can only live in a project; anywhere else it waits in Unsorted.
  useEffect(() => { if (kind === 'step' && where.kind === 'goal') setWhere(UNSORTED); }, [kind, where.kind]);

  const save = async () => {
    const body = text.trim();
    if (!body || !snap) { setError('Write a few words first, then save.'); ref.current?.focus(); return; }
    setBusy(true);
    try {
      const galaxyOf = (t: Target): string | null => {
        if (t.kind === 'goal') return snap.goals.find((g) => g.id === t.id)?.galaxyId ?? null;
        if (t.kind === 'project') return snap.projects.find((p) => p.id === t.id)?.galaxyId ?? null;
        if (t.id === UNSORTED.id) return focus.galaxyId;
        return t.id;
      };
      const inGalaxy = galaxyOf(where);
      let message = '';
      if (kind === 'memory') {
        await mindOps.addJournal({
          title: body, galaxyId: where.id === UNSORTED.id ? focus.galaxyId : inGalaxy,
          ...(where.kind === 'goal' ? { goalId: where.id } : {}),
          ...(where.kind === 'project' ? { projectId: where.id } : {}),
        });
        message = 'Kept in your journal for today.';
      } else if (kind === 'step' && where.kind === 'project') {
        await mindOps.addStep({ projectId: where.id, text: body, kind: 'once' });
        message = `A step in ${where.title}. Steps live on the project’s page, never in the sky.`;
      } else {
        const placedAt = where.id === UNSORTED.id ? {} : where.kind === 'goal' ? { goalId: where.id } : where.kind === 'project' ? { projectId: where.id } : {};
        const t = await mindOps.addThought({
          text: body, galaxyId: inGalaxy, isQuestion: kind === 'question' || /\?\s*$/.test(body),
          ...placedAt, ...(kind === 'step' ? { intent: 'step' as const } : {}),
        });
        if (where.kind === 'galaxy' && where.id !== UNSORTED.id) await mindOps.keepThought(t.id);
        message = where.id === UNSORTED.id
          ? `Saved. It waits in Unsorted until you are ready${kind === 'step' ? ' to give it a project' : ''}.`
          : where.kind === 'galaxy' ? `Kept in ${where.title}.` : `Saved. It now circles ${where.title}.`;
      }
      const mote: MoteTarget | null = kind === 'memory' ? null
        : where.kind === 'goal' ? { kind: 'goal', id: where.id }
        : where.kind === 'project' ? { kind: 'project', id: where.id }
        : inGalaxy ? { kind: 'galaxy', id: inGalaxy } : { kind: 'drift' };
      fly(formRef.current, kind === 'memory' ? 'journal' : 'sky', mote);
      closeCapture();
      say(message);
    } finally {
      setBusy(false);
    }
  };

  const options = [UNSORTED, ...chips, ...(extra && !chips.some((c) => c.id === extra.id) ? [extra] : [])];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="scrim" ref={scrimRef} className="capture-scrim" onClick={closeCapture} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} />
          <motion.form
            key="sheet"
            ref={formRef}
            className="capture plate"
            role="dialog"
            aria-modal="true"
            aria-label="Capture"
            onSubmit={(e) => { e.preventDefault(); void save(); }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="capture__head">
              <h2 className="capture__title">Capture</h2>
              <button type="button" className="capture__cancel" onClick={closeCapture}>Cancel</button>
            </div>
            <textarea
              id="capture-text"
              ref={ref}
              className="capture__text"
              rows={3}
              value={text}
              placeholder={kind === 'memory' ? 'What happened?' : kind === 'step' ? 'Something you can do in one sitting' : kind === 'question' ? 'What are you unsure about?' : "What's on your mind?"}
              onChange={(e) => { setText(e.target.value); if (error) setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save(); } }}
              aria-label="What to capture"
            />
            <fieldset className="capture__group">
              <legend>What is it?</legend>
              <div className="chips">
                {KINDS.map((k) => (
                  <label key={k.id} className="chip">
                    <input type="radio" name="capture-kind" checked={kind === k.id} onChange={() => setKind(k.id)} />
                    <span>{k.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="capture__group">
              <legend>{kind === 'memory' ? 'About (optional)' : kind === 'step' ? 'Which project?' : 'Where does it go?'}</legend>
              {picking ? (
                <HomePicker
                  mode={kind === 'step' ? 'project' : 'home'}
                  onPick={(t) => { setExtra(t); setWhere(t); setPicking(false); }}
                  onCancel={() => setPicking(false)}
                />
              ) : (
                <div className="chips">
                  {options.map((t) => (
                    <label key={t.id} className="chip">
                      <input type="radio" name="capture-where" checked={where.id === t.id} onChange={() => setWhere(t)} />
                      <span>{t.id === UNSORTED.id && kind === 'memory' ? 'Just the journal' : t.title}</span>
                    </label>
                  ))}
                  <button type="button" className="chip chip--more" onClick={() => setPicking(true)}>Somewhere else…</button>
                </div>
              )}
            </fieldset>
            {error && <p className="capture__error" role="alert">{error}</p>}
            <div className="capture__foot">
              <span className="capture__hint">Add your own tags with #words · ⌘ Enter saves</span>
              <button type="submit" className="instrument instrument--primary" disabled={busy}>Save</button>
            </div>
          </motion.form>
        </>
      )}
    </AnimatePresence>
  );
}

/** A point of light leaves the sheet and settles into the sky, or into the journal. */
function fly(from: HTMLElement | null, to: 'sky' | 'journal', mote: MoteTarget | null) {
  if (!from || motionReduced()) return;
  const sky = useSky.getState();
  const onSky = location.pathname === '/' || /^\/(goal|project)\//.test(location.pathname);
  if (mote && sky.live && sky.launch && onSky && !(location.pathname === '/' && sky.mode === 'list')) {
    const r = from.getBoundingClientRect();
    sky.launch(r.left + r.width / 2, r.top + Math.min(r.height * 0.3, 110), mote);
    return;
  }
  const target = document.querySelector<HTMLElement>(`[data-dock="${to}"]`);
  if (!target) return;
  const a = from.getBoundingClientRect(), b = target.getBoundingClientRect();
  const dot = document.createElement('div');
  dot.className = 'capture-mote';
  document.body.appendChild(dot);
  const sx = a.left + a.width / 2, sy = a.top + Math.min(a.height * 0.3, 110);
  const ex = b.left + b.width / 2, ey = b.top + 14;
  const mx = (sx + ex) / 2 + (ex > sx ? 70 : -70), my = Math.min(sy, ey) - 90;
  const anim = dot.animate(
    [{ transform: `translate(${sx}px, ${sy}px) scale(1.6)`, opacity: 0 }, { transform: `translate(${mx}px, ${my}px) scale(1)`, opacity: 1, offset: 0.45 }, { transform: `translate(${ex}px, ${ey}px) scale(0.6)`, opacity: 0.9 }],
    { duration: 1100, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'forwards' },
  );
  anim.onfinish = () => {
    dot.remove();
    target.classList.add('dock__item--glow');
    window.setTimeout(() => target.classList.remove('dock__item--glow'), 1400);
  };
}

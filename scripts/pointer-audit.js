/**
 * Release check: can a finger actually reach every control?
 *
 * Scripted clicks go straight to an element and ignore anything drawn on top
 * of it, which is how a star canvas covering the first-goal form shipped
 * unnoticed. This check asks the browser what a real tap would hit: it
 * scrolls each control into view and compares the topmost element at its
 * centre with the control itself.
 *
 * In the dev server (`npm run dev`), from the browser console:
 *   const a = await import('/scripts/pointer-audit.js');
 *   a.auditPointers();          // the current screen
 *   await a.tourDemo();         // every place and open form, in Alex's museum (open it first)
 *   await a.tourEmpty();        // the same for a brand-new empty museum
 *
 * Names floating in the 3D sky can sit behind a plate or the dock by design;
 * they are counted as `skyLabels` and are not failures.
 *
 * A release is ready when, on every screen, `blocked`, `iosZoom` and (on a
 * touch screen) `tooSmall` are all empty. Fields under 16px make iPhone zoom
 * the whole page on tap; touch zones under 44px are hard to hit with a thumb.
 */

const CONTROLS = 'input:not([type=hidden]):not([type=file]), textarea, select, button, a[href], [role=button], [role=tab], [role=radio], [role=option]';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function describe(el) {
  if (!el) return 'nothing';
  const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : '';
  return el.tagName.toLowerCase() + cls;
}
function labelOf(el) {
  return (el.getAttribute('aria-label') || el.placeholder || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
}
function visible(el) {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.pointerEvents !== 'none'
    && !el.closest('[hidden], [inert], [aria-hidden="true"], .visually-hidden, .skylbl:not(.on), .skylbl.clash');
}

export function auditPointers() {
  const all = [...document.querySelectorAll(CONTROLS)].filter(visible);
  // Names in the sky float behind plates by design; report them separately.
  const skyLabels = all.filter((e) => e.closest('.skylbl'));
  const controls = all.filter((e) => !e.closest('.skylbl'));
  const blocked = [];
  const iosZoom = [];
  for (const el of controls) {
    el.scrollIntoView({ block: 'center', inline: 'center' });
    // A link that wraps onto two lines has a box whose middle can fall in the
    // gap between the lines. Test the middle of its first line instead, which
    // is where the words are and where a finger lands.
    const rects = el.getClientRects();
    const r = rects.length > 1 ? rects[0] : el.getBoundingClientRect();
    const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2));
    const y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
    const hit = document.elementFromPoint(x, y);
    const reachable = hit && (hit === el || el.contains(hit) || hit.closest('label')?.contains(el));
    if (!reachable) blocked.push(`${labelOf(el)} covered by ${describe(hit)}`);
    // iPhone zooms into text fields and dropdowns under 16px, never into
    // checkboxes, radio buttons, or sliders.
    const typesItZooms = el.tagName !== 'INPUT' || !/^(checkbox|radio|range|button|submit|color)$/.test(el.type);
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && typesItZooms && parseFloat(getComputedStyle(el).fontSize) < 16) iosZoom.push(labelOf(el));
  }
  window.scrollTo(0, 0);
  return { controls: controls.length, skyLabels: skyLabels.length, blocked, iosZoom };
}

async function go(path) {
  history.pushState({}, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
  await sleep(1400);
}
async function press(text, scope = document) {
  const el = [...scope.querySelectorAll('button, a, [role=button], [role=tab]')].find((b) => b.textContent.trim().startsWith(text));
  if (!el) return false;
  el.click();
  await sleep(500);
  return true;
}
async function pick(selector) {
  const el = document.querySelector(selector);
  if (!el) return false;
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await sleep(500);
  return true;
}

/**
 * Jump every running animation to its end, so a check measures the settled
 * screen. A background tab does not advance animations at all, which would
 * otherwise leave entrances half-revealed and closing sheets half-faded.
 */
async function settle() {
  for (const a of document.getAnimations?.() ?? []) { try { a.finish(); } catch { /* endless ambient loops cannot finish */ } }
  await sleep(120);
}

async function run(steps) {
  const out = {};
  for (const [name, action] of steps) {
    const reached = await action();
    await settle();
    out[name] = reached === false
      ? { skipped: 'state not reachable here' }
      : { ...auditPointers(), tooSmall: matchMedia('(pointer: coarse)').matches ? auditTouchTargets().tooSmall : [] };
  }
  return out;
}

/** Every place and every open form, in Alex's museum. */
export function tourDemo() {
  return run([
    ['sky: every galaxy', () => go('/')],
    ['sky: one galaxy', () => go('/?galaxy=d-gx-app')],
    ['sky: a goal up close', () => go('/?goal=d-g-app')],
    ['sky: as a list', async () => { await go('/'); return press('List'); }],
    ['sky: back to the sky', () => press('Sky')],
    ['capture', () => pick('[data-dock="capture"]')],
    ['capture: somewhere else', () => press('Somewhere else')],
    ['today', async () => { await pick('.capture__cancel'); return go('/today'); }],
    ['today: choose focus', () => press('Choose')],
    ['unsorted', () => go('/unsorted')],
    ['unsorted: give it a home', () => press('Give it a home')],
    ['clear my mind', () => go('/clear')],
    ['search', () => go('/search')],
    ['goal page', () => go('/goal/d-g-app')],
    ['goal: a new project', () => press('A new project')],
    ['goal: edit', async () => { await press('Close'); return press('Edit'); }],
    ['project page', () => go('/project/d-p-users')],
    ['project: add a step', () => press('Add a step')],
    ['project: change its shape', async () => { await press('Close'); return press('Change its shape'); }],
    ['journal', () => go('/journal')],
    ['your week', () => go('/review')],
    ['settings', () => go('/settings')],
  ]);
}

/** The same places for a museum with nothing in it yet. */
export function tourEmpty() {
  return run([
    ['sky (empty): first star', () => go('/')],
    ['sky (empty) as a list', () => press('List')],
    ['today (empty)', () => go('/today')],
    ['unsorted (empty)', () => go('/unsorted')],
    ['search (empty)', () => go('/search')],
    ['journal (empty)', () => go('/journal')],
    ['your week (empty)', () => go('/review')],
    ['settings (empty)', () => go('/settings')],
  ]);
}

/**
 * Is every control comfortable for a fingertip? Taps 20px above and below
 * the centre of each control must still land on it, which is what a 44px
 * touch zone means. Measures the real hit area, including invisible zones.
 */
export function auditTouchTargets() {
  const els = [...document.querySelectorAll(CONTROLS)].filter(visible).filter((e) => !e.closest('.skylbl') && !/^(checkbox|radio)$/.test(e.type));
  const tooSmall = [];
  for (const el of els) {
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const rects = el.getClientRects();
    const r = rects.length > 1 ? rects[0] : el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const lands = (dy) => { const h = document.elementFromPoint(x, y + dy); return !!h && (h === el || el.contains(h)); };
    if (!lands(-20) || !lands(20)) tooSmall.push(`${labelOf(el)} (${Math.round(r.height)}px tall)`);
  }
  window.scrollTo(0, 0);
  return { controls: els.length, tooSmall };
}

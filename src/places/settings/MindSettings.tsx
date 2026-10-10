import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearSessionKey, hasSessionKey, onSessionKeyChange } from '@/ai/session';
import { BackupError } from '@/data/backup';
import { downloadText, stampedName } from '@/lib/download';
import { relativeAge } from '@/lib/dates';
import { DEMO_MIND_ID } from '@/mind/demo';
import { exportAll, importText, lastBackupAt, preMoveBackup, type ImportMode } from '@/mind/files';
import { mindOps } from '@/mind/ops';
import { galaxiesOf } from '@/mind/select';
import { useMind } from '@/mind/store';
import { GALAXY_HUES, type Galaxy } from '@/mind/types';
import { hueVar } from '@/shell/Glyphs';
import { useSettingsStore } from '@/store/settings';
import { useUiStore } from '@/store/ui';
import './settings.css';

export default function MindSettings() {
  const navigate = useNavigate();
  const { mind, snap, minds, renameMind, enter, leave, deleteMind, resetDemo, reload } = useMind();
  const settings = useSettingsStore();
  const { say, installPrompt, setInstallPrompt } = useUiStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [busy, setBusy] = useState(false);
  const [backupAt, setBackupAt] = useState<number | null>(null);
  const [before, setBefore] = useState<{ at: number; json: string } | null>(null);
  const [name, setName] = useState(mind?.name ?? '');
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [keyHeld, setKeyHeld] = useState(hasSessionKey());
  useEffect(() => onSessionKeyChange(() => setKeyHeld(hasSessionKey())), []);
  useEffect(() => { void lastBackupAt().then(setBackupAt); void preMoveBackup().then(setBefore); }, []);
  useEffect(() => setName(mind?.name ?? ''), [mind?.name]);
  if (!mind || !snap) return null;
  const isDemo = mind.id === DEMO_MIND_ID;
  const live = <T extends { deletedAt?: number }>(xs: T[]) => xs.filter((x) => !x.deletedAt);
  const own = minds.filter((m) => m.kind === 'own');

  const exportNow = async () => {
    setBusy(true);
    try {
      downloadText(stampedName('museum-of-my-mind'), await exportAll());
      setBackupAt(Date.now());
      say('A copy of every museum of yours is in your downloads.');
    } finally { setBusy(false); }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await importText(await file.text(), mode);
      await reload();
      say(`Restored ${r.records} item${r.records === 1 ? '' : 's'}${r.fromOlderVersion ? ' from an older backup, moved into the new museum' : ''}.${r.warnings.length ? ` ${r.warnings.length} loose link${r.warnings.length === 1 ? ' was' : 's were'} kept as they were.` : ''}`);
      if (r.firstMindId && r.firstMindId !== mind.id) { await enter(r.firstMindId); navigate('/'); }
    } catch (e) {
      say(e instanceof BackupError ? e.message : 'That file could not be read.', undefined, { quiet: true });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
    say(outcome === 'accepted' ? 'The museum now has a door on your home screen.' : 'The museum stays in the browser for now.');
  };

  return (
    <div className="place plate settings2">
      <header className="place__head">
        <p className="place__eyebrow">Settings</p>
        <h1 className="place__title">{mind.name}</h1>
        <p className="place__lede">
          {isDemo ? "Alex's museum is fictional. Change anything; it resets itself every two weeks, or when you reload it below." : `Lives only in this browser · opened ${relativeAge(mind.createdAt)}`}
        </p>
      </header>

      <section className="place__section">
        <h2 className="place__h2">This museum</h2>
        {!isDemo && (
          <form className="inline-add" onSubmit={(e) => { e.preventDefault(); void renameMind(name).then(() => say('Renamed.')); }}>
            <input id="mind-name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Museum name" />
            <button type="submit" className="instrument" disabled={!name.trim() || name.trim() === mind.name}>Rename</button>
          </form>
        )}
        <p className="meta tabular">
          {live(snap.galaxies).length} galaxies · {live(snap.goals).length} goals · {live(snap.projects).length} projects · {live(snap.steps).length} steps · {live(snap.thoughts).length} thoughts · {live(snap.journal).length} journal entries
        </p>
      </section>

      <section className="place__section">
        <h2 className="place__h2">Galaxies</h2>
        <ul className="rows">{galaxiesOf(snap).map((g) => <GalaxyRow key={g.id} g={g} />)}</ul>
      </section>

      <section className="place__section">
        <h2 className="place__h2">Backup</h2>
        <p className="settings2__p">One file holds every museum of yours. Keep it somewhere you trust, such as iCloud Drive, and open it on another device to move everything across. {backupAt ? `Last saved ${relativeAge(backupAt)}.` : 'No backup has been saved from this browser yet.'}</p>
        <div className="form-actions">
          <button type="button" className="instrument instrument--primary" onClick={() => void exportNow()} disabled={busy}>Save a backup</button>
          <button type="button" className="instrument" onClick={() => fileRef.current?.click()} disabled={busy}>Open a backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
        <div className="chips" role="radiogroup" aria-label="When opening a backup">
          <label className="chip"><input type="radio" name="import-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /><span>Keep what is here and add what is new</span></label>
          <label className="chip"><input type="radio" name="import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /><span>Replace matching museums</span></label>
        </div>
        <p className="meta">Backups from every earlier version open too; they are moved into the new museum on the way in.</p>
        {before && (
          <p className="settings2__p">
            A full copy of your museum from before the move ({relativeAge(before.at)}) is kept here.{' '}
            <button type="button" className="linkish" onClick={() => downloadText(stampedName('museum-before-the-move', before.at), before.json)}>Download it</button>
          </p>
        )}
      </section>

      <section className="place__section">
        <h2 className="place__h2">Atmosphere</h2>
        <label className="settings2__toggle">
          <input type="checkbox" checked={settings.soundEnabled} onChange={(e) => void settings.update({ soundEnabled: e.target.checked })} />
          Subtle sound when you move between places and keep something. Off by default.
        </label>
        <label className="settings2__toggle">
          <span>Motion</span>
          <select value={settings.reduceMotion} onChange={(e) => void settings.update({ reduceMotion: e.target.value as 'system' | 'on' | 'off' })}>
            <option value="system">Follow the system</option>
            <option value="on">Reduce motion</option>
            <option value="off">Full motion</option>
          </select>
        </label>
        {installPrompt && <div className="form-actions"><button type="button" className="instrument" onClick={() => void install()}>Add the museum to this device</button></div>}
      </section>

      <section className="place__section">
        <h2 className="place__h2">Ask my AI</h2>
        <p className="settings2__p">Optional, off by default, never needed. With it on, the weekly review can ask your own Claude to reflect on a week you choose, using your own Anthropic key. The key lives only in this tab's memory and is forgotten when the tab closes. Nothing changes in your museum unless you accept it.</p>
        <label className="settings2__toggle">
          <input type="checkbox" checked={settings.aiEnabled} onChange={(e) => { void settings.update({ aiEnabled: e.target.checked }); if (!e.target.checked) clearSessionKey(); }} />
          Turn on “Ask my AI” (bring your own key)
        </label>
        {keyHeld && <button type="button" className="instrument instrument--quiet" onClick={() => { clearSessionKey(); say('The session key is forgotten.', undefined, { quiet: true }); }}>Forget the session key now</button>}
      </section>

      <section className="place__section">
        <h2 className="place__h2">Museums</h2>
        <div className="form-actions">
          {isDemo ? (
            <>
              <button type="button" className="instrument" onClick={() => void resetDemo().then(() => say("Alex's museum is as it was."))}>Reset Alex's museum</button>
              {own[0] ? <button type="button" className="instrument instrument--primary" onClick={() => void enter(own[0]!.id).then(() => navigate('/'))}>Back to {own[0].name}</button> : <button type="button" className="instrument instrument--primary" onClick={() => void leave().then(() => navigate('/welcome'))}>Begin my own museum</button>}
            </>
          ) : (
            <>
              <button type="button" className="instrument" onClick={() => void enter(DEMO_MIND_ID).then(() => navigate('/'))}>Look around Alex's museum (the demo)</button>
              <button type="button" className="instrument instrument--quiet" onClick={() => void leave().then(() => navigate('/welcome'))}>Switch museum</button>
            </>
          )}
        </div>
        {!isDemo && !confirming && <button type="button" className="instrument instrument--ember settings2__delete" onClick={() => { setConfirming(true); setTyped(''); }}>Delete this museum…</button>}
        {!isDemo && confirming && (
          <div className="danger">
            <p className="settings2__p">This removes “{mind.name}” and everything in it from this browser, for good. Save a backup first if there is any doubt.</p>
            <label className="field"><span className="plaque">Type the museum's name to confirm</span><input className="field__input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus /></label>
            <div className="form-actions">
              <button type="button" className="instrument instrument--ember" disabled={typed.trim() !== mind.name} onClick={() => void deleteMind(mind.id).then(() => { say('Deleted. Your other museums are untouched.', undefined, { quiet: true }); navigate('/welcome'); })}>Delete for good</button>
              <button type="button" className="instrument instrument--quiet" onClick={() => setConfirming(false)}>Keep it</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function GalaxyRow({ g }: { g: Galaxy }) {
  const [name, setName] = useState(g.name);
  const say = useUiStore((s) => s.say);
  return (
    <li className="galaxyrow" style={{ ['--tint' as string]: hueVar(g.hue) }}>
      <form className="galaxyrow__form" onSubmit={(e) => { e.preventDefault(); if (name.trim()) void mindOps.updateGalaxy(g.id, { name: name.trim() }).then(() => say('Renamed.')); }}>
        <span className="galaxy__mark" aria-hidden="true" />
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label={`Name of ${g.name}`} />
        {name.trim() !== g.name && name.trim() && <button type="submit" className="linkish">Save</button>}
      </form>
      <div className="galaxyrow__hues" role="radiogroup" aria-label={`Colour of ${g.name}`}>
        {GALAXY_HUES.map((h) => (
          <button key={h} type="button" role="radio" aria-checked={g.hue === h} aria-label={h} className="hue" style={{ ['--h' as string]: hueVar(h) }} onClick={() => void mindOps.updateGalaxy(g.id, { hue: h })} />
        ))}
      </div>
    </li>
  );
}

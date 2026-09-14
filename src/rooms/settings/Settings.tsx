import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Instrument } from '@/components/Instrument';
import { TextField } from '@/components/Field';
import { exportBackup, importBackup, parseBackup, serializeBackup, BackupError, type ImportMode } from '@/data/backup';
import { META_KEYS, metaRepo } from '@/data/repo/meta';
import { resetDemo, DEMO_MUSEUM_ID } from '@/data/seed';
import { relativeAge } from '@/lib/dates';
import { useMuseumStore } from '@/store/museum';
import { useSettingsStore } from '@/store/settings';
import { useUiStore } from '@/store/ui';
import './Settings.css';

export default function Settings() {
  const navigate = useNavigate();
  const active = useMuseumStore((s) => s.active);
  const records = useMuseumStore((s) => s.records);
  const enter = useMuseumStore((s) => s.enter);
  const leave = useMuseumStore((s) => s.leave);
  const deleteMuseum = useMuseumStore((s) => s.deleteMuseum);
  const settings = useSettingsStore();
  const say = useUiStore((s) => s.say);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [busy, setBusy] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');

  useEffect(() => { void metaRepo.get<number>(META_KEYS.lastBackupAt).then((v) => setLastBackupAt(v ?? null)); }, []);

  const counts = {
    goals: records.goals.length, projects: records.projects.length, actions: records.actions.length,
    notes: records.notes.length, links: records.links.length, memories: records.memories.length,
    threads: records.threads.length, scenarios: records.scenarios.length,
  };
  const lastTouched = Math.max(0, ...Object.values(records).flat().map((r) => (r as { updatedAt?: number }).updatedAt ?? 0));

  const download = async () => {
    setBusy(true);
    try {
      const backup = await exportBackup();
      const blob = new Blob([serializeBackup(backup)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `museum-of-my-mind-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const now = Date.now();
      await metaRepo.set(META_KEYS.lastBackupAt, now);
      setLastBackupAt(now);
      say('A copy of every museum is in your downloads.');
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const backup = parseBackup(await file.text());
      const result = await importBackup(backup, mode);
      if (active) await enter(active.id);
      say(`Restored ${result.records} item${result.records === 1 ? '' : 's'} across ${result.museums} museum${result.museums === 1 ? '' : 's'}.`);
    } catch (e) {
      say(e instanceof BackupError ? e.message : 'That file could not be read.', undefined, { quiet: true });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const reloadDemo = async () => {
    setBusy(true);
    try {
      await resetDemo();
      if (active?.id === DEMO_MUSEUM_ID) await enter(DEMO_MUSEUM_ID);
      say("Alex's museum is as it was.");
    } finally {
      setBusy(false);
    }
  };

  const destroy = async () => {
    if (!active || active.kind !== 'own' || typed.trim() !== active.name) return;
    setBusy(true);
    try {
      const name = active.name;
      await deleteMuseum(active.id);
      say(`${name} is gone. The other museums are untouched.`, undefined, { quiet: true });
      navigate('/');
    } finally {
      setBusy(false);
    }
  };

  const exit = async () => { await leave(); navigate('/'); };
  const isDemo = active?.kind === 'demo';

  return (
    <section className="settings">
      <header className="settings__head">
        <span className="plaque">Keeper's desk</span>
        <h1 className="settings__title">Backups, quiet, and the way out</h1>
      </header>

      {active && (
        <div className="settings__group">
          <h2 className="settings__h2">About this museum</h2>
          <dl className="about">
            <div><dt className="plaque">Name</dt><dd className="display">{active.name}{active.visitorName ? <span className="about__keeper"> · kept by {active.visitorName}</span> : null}{isDemo && <span className="about__keeper"> · the demo, fictional</span>}</dd></div>
            <div><dt className="plaque">Holds</dt><dd className="tabular">{counts.goals} goals · {counts.projects} projects · {counts.actions} steps · {counts.notes} notes · {counts.links} links · {counts.memories} memories · {counts.threads} threads · {counts.scenarios} what-ifs</dd></div>
            <div><dt className="plaque">Last touched</dt><dd>{lastTouched ? relativeAge(lastTouched) : 'never'}</dd></div>
            <div><dt className="plaque">Last backup</dt><dd>{lastBackupAt ? relativeAge(lastBackupAt) : 'never exported from this browser'}</dd></div>
            <div><dt className="plaque">Opened</dt><dd>{relativeAge(active.createdAt)} · lives only in this browser</dd></div>
          </dl>
        </div>
      )}

      <div className="settings__group">
        <h2 className="settings__h2">Backup</h2>
        <p className="settings__p">One file holds every museum in this browser. Keep it somewhere you trust.</p>
        <div className="settings__row">
          <Instrument tone="primary" onClick={() => void download()} disabled={busy}>Export everything</Instrument>
        </div>
        <div className="settings__row">
          <label className="settings__mode">
            <input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Merge (keep what is here)
          </label>
          <label className="settings__mode">
            <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace (overwrite matching museums)
          </label>
          <Instrument onClick={() => fileRef.current?.click()} disabled={busy}>Import a backup</Instrument>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
      </div>

      <div className="settings__group">
        <h2 className="settings__h2">Atmosphere</h2>
        <label className="settings__toggle">
          <input type="checkbox" checked={settings.soundEnabled} onChange={(e) => void settings.update({ soundEnabled: e.target.checked })} />
          Subtle sound: a hinge when you change rooms, a small bell when something is kept. Silent under reduced motion.
        </label>
        <label className="settings__toggle">
          <span>Motion</span>
          <select value={settings.reduceMotion} onChange={(e) => void settings.update({ reduceMotion: e.target.value as 'system' | 'on' | 'off' })}>
            <option value="system">Follow the system</option>
            <option value="on">Reduce motion</option>
            <option value="off">Full motion</option>
          </select>
        </label>
      </div>

      <div className="settings__group">
        <h2 className="settings__h2">Housekeeping</h2>
        <div className="settings__row">
          {isDemo && <Instrument onClick={() => void reloadDemo()} disabled={busy}>Reload the demo collection</Instrument>}
          <Instrument tone="quiet" onClick={() => void exit()}>Leave through the entrance</Instrument>
        </div>
        {isDemo && <p className="settings__p">Reloading puts Alex's museum back exactly as it was seeded. Your own museums are never touched.</p>}

        {active && active.kind === 'own' && !confirming && (
          <div className="settings__row">
            <Instrument tone="ember" onClick={() => { setConfirming(true); setTyped(''); }}>Delete this museum…</Instrument>
          </div>
        )}
        {active && active.kind === 'own' && confirming && (
          <div className="danger">
            <span className="plaque">Delete “{active.name}”?</span>
            <p className="settings__p">This removes the museum and everything in it from this browser, for good. The demo and any other museums stay. There is no undo, so keep a copy first.</p>
            <div className="settings__row">
              <Instrument tone="primary" onClick={() => void download()} disabled={busy}>Export a backup first</Instrument>
              <span className="settings__p">{lastBackupAt ? `Last backup ${relativeAge(lastBackupAt)}.` : 'No backup has been exported from this browser.'}</span>
            </div>
            <TextField label={`Type the museum's name to confirm: ${active.name}`} value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
            <div className="settings__row">
              <Instrument tone="ember" onClick={() => void destroy()} disabled={busy || typed.trim() !== active.name}>Delete “{active.name}” for good</Instrument>
              <Instrument tone="quiet" onClick={() => { setConfirming(false); setTyped(''); }}>Keep it</Instrument>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Instrument } from '@/components/Instrument';
import { exportBackup, importBackup, parseBackup, serializeBackup, BackupError, type ImportMode } from '@/data/backup';
import { resetDemo, DEMO_MUSEUM_ID } from '@/data/seed';
import { useMuseumStore } from '@/store/museum';
import { useSettingsStore } from '@/store/settings';
import { useUiStore } from '@/store/ui';
import './Settings.css';

export default function Settings() {
  const navigate = useNavigate();
  const active = useMuseumStore((s) => s.active);
  const enter = useMuseumStore((s) => s.enter);
  const leave = useMuseumStore((s) => s.leave);
  const settings = useSettingsStore();
  const say = useUiStore((s) => s.say);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [busy, setBusy] = useState(false);

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
      say(e instanceof BackupError ? e.message : 'That file could not be read.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await resetDemo();
      if (active?.id === DEMO_MUSEUM_ID) await enter(DEMO_MUSEUM_ID);
      say("Alex's museum is as it was.");
    } finally {
      setBusy(false);
    }
  };

  const exit = async () => {
    await leave();
    navigate('/');
  };

  return (
    <section className="settings">
      <header className="settings__head">
        <span className="plaque">Keeper's desk</span>
        <h1 className="settings__title">Backups, quiet, and the way out</h1>
      </header>

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
          Subtle sound (a door, a tick)
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
          <Instrument onClick={() => void reset()} disabled={busy}>Restore the demo museum</Instrument>
          <Instrument tone="quiet" onClick={() => void exit()}>Leave through the entrance</Instrument>
        </div>
      </div>
    </section>
  );
}

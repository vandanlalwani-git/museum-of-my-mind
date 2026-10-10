import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import qrcode from 'qrcode-generator';
import { relativeAge } from '@/lib/dates';
import { useMind } from '@/mind/store';
import { QR_PREFIX } from '@/sync/code';
import { enableSync, joinWithCode, replaceCode, stopSync, syncNow, useSync, type SyncProblem } from '@/sync/agent';
import { useUiStore } from '@/store/ui';
import './devices.css';

const PROBLEM: Record<Exclude<SyncProblem, null>, string> = {
  offline: 'Waiting for a connection. Changes are kept here and will be sent.',
  unpaired: 'This device is no longer paired: the code was replaced on another device. Join again with the new code.',
  full: 'The sync mailbox is full. Save a backup and tell the museum’s maker.',
  error: 'Sync could not finish just now. It will try again on its own.',
};

/** Settings › Your devices: pair once with a code, then forget about it. */
export default function Devices() {
  const mind = useMind((s) => s.mind);
  const minds = useMind((s) => s.minds);
  const { state, busy, problem } = useSync();
  const say = useUiStore((s) => s.say);
  const [showCode, setShowCode] = useState(false);
  const [joining, setJoining] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  if (!mind) return null;
  const pairedHere = state?.mindId === mind.id;
  const pairedElsewhere = state && !pairedHere ? minds.find((m) => m.id === state.mindId) : undefined;

  const turnOn = async () => {
    setWorking(true); setError('');
    try { await enableSync(); setShowCode(true); say('Sync is on. Now pair your other device.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Sync could not start.'); }
    finally { setWorking(false); }
  };

  return (
    <section className="place__section devices" aria-labelledby="devices-title">
      <h2 id="devices-title" className="place__h2">Your devices</h2>
      {mind.kind === 'demo' ? (
        <p className="settings2__p">Sync is for your own museums. Alex’s museum stays on this device.</p>
      ) : pairedHere ? (
        <>
          <p className="devices__status">
            <span className={`devices__dot ${problem ? 'devices__dot--warn' : busy ? 'devices__dot--busy' : ''}`} aria-hidden="true" />
            {problem ? PROBLEM[problem] : busy ? 'Syncing…' : state.lastSyncAt ? `In sync · ${relativeAge(state.lastSyncAt) === 'today' ? 'just now' : relativeAge(state.lastSyncAt)}` : 'Sync is on.'}
          </p>
          <div className="form-actions">
            <button type="button" className="instrument" onClick={() => void syncNow()} disabled={busy}>Sync now</button>
            <button type="button" className="instrument" onClick={() => setShowCode((v) => !v)}>{showCode ? 'Hide the pairing code' : 'Pair another device'}</button>
          </div>
          {showCode && <PairingCode code={state.code} />}
          <details className="devices__more">
            <summary>If a device is lost, or to stop</summary>
            <p className="settings2__p">Stopping keeps everything on this device; your other devices carry on. Replacing the code locks out every device that has the old one, including a lost phone. Your devices then join again with the new code.</p>
            <div className="form-actions">
              <button type="button" className="instrument instrument--quiet" onClick={() => void stopSync().then(() => say('Sync is off on this device. Everything is still here.'))}>Stop syncing on this device</button>
              {!confirmReplace ? (
                <button type="button" className="instrument instrument--ember" onClick={() => setConfirmReplace(true)}>Replace the code…</button>
              ) : (
                <>
                  <button type="button" className="instrument instrument--ember" disabled={working} onClick={() => { setWorking(true); void replaceCode().then(() => { setShowCode(true); setConfirmReplace(false); say('A new code. Old devices are locked out.'); }).finally(() => setWorking(false)); }}>Replace it now</button>
                  <button type="button" className="instrument instrument--quiet" onClick={() => setConfirmReplace(false)}>Keep the code</button>
                </>
              )}
            </div>
          </details>
        </>
      ) : (
        <>
          <p className="settings2__p">Keep this museum the same on your Mac and your iPhone. Everything is locked on this device before it leaves, and the server stores only scrambled data it cannot read. No account, no cost.</p>
          {pairedElsewhere && <p className="settings2__p">Sync is on for “{pairedElsewhere.name}” on this device. Turning it on here moves it to this museum.</p>}
          <div className="form-actions">
            <button type="button" className="instrument instrument--primary" onClick={() => void turnOn()} disabled={working}>Turn on sync for “{mind.name}”</button>
            <button type="button" className="instrument" onClick={() => setJoining((v) => !v)}>{joining ? 'Close' : 'Join a museum from another device'}</button>
          </div>
          {error && <p className="capture__error" role="alert">{error}</p>}
          {state?.mindId === mind.id && showCode && <PairingCode code={state.code} />}
          {joining && <Join onDone={() => setJoining(false)} />}
        </>
      )}
    </section>
  );
}

function PairingCode({ code }: { code: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(QR_PREFIX + code.replace(/-/g, ''));
    qr.make();
    const n = qr.getModuleCount(), q = 4;
    let path = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c + q} ${r + q}h1v1h-1z`;
    return { size: n + q * 2, path };
  }, [code]);
  return (
    <div className="pairing">
      <svg className="pairing__qr" viewBox={`0 0 ${svg.size} ${svg.size}`} role="img" aria-label="Pairing code as a QR code" shapeRendering="crispEdges">
        <rect className="pairing__light" width={svg.size} height={svg.size} />
        <path className="pairing__dark" d={svg.path} />
      </svg>
      <div className="pairing__text">
        <p className="settings2__p">On your other device, open the museum, go to Settings, Your devices, Join. Scan this, or type the code:</p>
        <p className="pairing__code tabular">{code}</p>
        <p className="meta">Anyone with this code can read and change this museum. Show it only to your own devices.</p>
      </div>
    </div>
  );
}

export function Join({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const say = useUiStore((s) => s.say);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  const join = async (value: string) => {
    setBusy(true); setError('');
    try {
      const m = await joinWithCode(value);
      say(`Joined. “${m.name}” is here, and stays in sync.`);
      onDone();
      navigate('/');
    } catch (e) { setError(e instanceof Error ? e.message : 'Joining did not work.'); setScanning(false); }
    finally { setBusy(false); }
  };

  return (
    <div className="join">
      <p className="settings2__p">Your other museums on this device stay as they are; the joined museum appears beside them.</p>
      {scanning ? <Scanner onCode={(c) => void join(c)} onCancel={() => setScanning(false)} /> : (
        <button type="button" className="instrument" onClick={() => setScanning(true)} disabled={busy}>Scan the code with the camera</button>
      )}
      <form className="inline-add" onSubmit={(e) => { e.preventDefault(); void join(code); }}>
        <input id="join-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXX" aria-label="Pairing code" autoCapitalize="characters" autoComplete="off" spellCheck={false} />
        <button type="submit" className="instrument instrument--primary" disabled={busy || code.replace(/[\s-]/g, '').length < 27}>{busy ? 'Joining…' : 'Join'}</button>
      </form>
      {error && <p className="capture__error" role="alert">{error}</p>}
    </div>
  );
}

/** Reads the pairing QR code with the camera. Nothing is recorded; frames are read on the device and dropped. */
function Scanner({ onCode, onCancel }: { onCode: (code: string) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const found = useRef(onCode);
  found.current = onCode;
  const [message, setMessage] = useState('Point the camera at the code on your other device.');
  useEffect(() => {
    let stream: MediaStream | null = null, raf = 0, done = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    (async () => {
      try {
        const [{ default: jsQR }, media] = await Promise.all([import('jsqr'), navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })]);
        stream = media;
        const video = videoRef.current;
        if (!video || done) return;
        video.srcObject = media;
        await video.play();
        const tick = () => {
          if (done) return;
          if (ctx && video.videoWidth) {
            const w = Math.min(640, video.videoWidth), h = Math.round((w / video.videoWidth) * video.videoHeight);
            canvas.width = w; canvas.height = h;
            ctx.drawImage(video, 0, 0, w, h);
            const hit = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
            if (hit?.data.startsWith(QR_PREFIX)) { done = true; found.current(hit.data); return; }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setMessage('The camera is not available here. Type the code instead.');
      }
    })();
    return () => { done = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  return (
    <div className="scanner">
      <video ref={videoRef} className="scanner__video" playsInline muted aria-label="Camera view" />
      <p className="meta">{message}</p>
      <button type="button" className="instrument instrument--quiet" onClick={onCancel}>Stop the camera</button>
    </div>
  );
}

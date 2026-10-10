import { useEffect, useRef } from 'react';
import { describeReport } from '@/mind/migrate';
import { preMoveBackup } from '@/mind/files';
import { useMind } from '@/mind/store';
import { downloadText, stampedName } from '@/lib/download';

/** Shown once, after the old rooms have moved into the new museum. */
export function MovedIn() {
  const report = useMind((s) => s.movedIn);
  const mind = useMind((s) => s.mind);
  const dismiss = useMind((s) => s.dismissMovedIn);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (report && mind?.kind === 'own') ref.current?.focus(); }, [report, mind]);
  if (!report || mind?.kind !== 'own') return null;

  const download = async () => {
    const b = await preMoveBackup();
    if (b) downloadText(stampedName('museum-before-the-move', b.at), b.json);
  };

  return (
    <>
      <div className="capture-scrim" aria-hidden="true" />
      <section className="movedin plate" role="dialog" aria-modal="true" aria-labelledby="movedin-title">
        <p className="place__eyebrow">A new home</p>
        <h2 id="movedin-title">Your museum has moved in</h2>
        <p className="place__lede">Everything you kept is here, arranged as a sky. A full copy of the old museum was saved before anything moved, and the old records are still stored, untouched.</p>
        <ul>{describeReport(report).map((l) => <li key={l}>{l}</li>)}</ul>
        <div className="movedin__actions">
          <button ref={ref} type="button" className="instrument instrument--primary" onClick={() => void dismiss()}>Look around</button>
          <button type="button" className="instrument" onClick={() => void download()}>Download the copy from before the move</button>
        </div>
      </section>
    </>
  );
}

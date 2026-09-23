import { useRef, useState, type KeyboardEvent } from 'react';
import { Instrument } from '@/components/Instrument';
import { isUrl } from '@/lib/text';

export type CaptureAs = 'note' | 'idea' | 'link' | 'project';

interface Props {
  /** Saves the text and returns what it became, so the follow-up can offer to change it. */
  onCapture: (text: string, as: CaptureAs) => Promise<void>;
  onReclassify: (as: CaptureAs) => Promise<void>;
  /** Set once something has just been saved; cleared when the visitor moves on. */
  saved: { text: string; as: CaptureAs } | null;
  onDismissSaved: () => void;
}

const OTHERS: Record<CaptureAs, CaptureAs[]> = {
  note: ['idea', 'link', 'project'],
  idea: ['note', 'link', 'project'],
  link: ['note', 'idea', 'project'],
  project: ['note', 'idea', 'link'],
};
const WORD: Record<CaptureAs, string> = { note: 'a note', idea: 'an idea', link: 'a link', project: 'a project' };

/**
 * One field. Type, press Enter, it is kept. The only follow-up is optional:
 * a single quiet row offering to change what it became.
 */
export function Capture({ onCapture, onReclassify, saved, onDismissSaved }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await onCapture(t, isUrl(t.split(/\s+/)[0] ?? '') ? 'link' : 'note');
      setText('');
      if (ref.current) { ref.current.style.height = 'auto'; ref.current.focus(); }
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); }
  };

  return (
    <div className="capture2">
      <div className="capture2__row">
        <textarea
          ref={ref}
          className="capture2__field"
          rows={1}
          value={text}
          onChange={(e) => { setText(e.target.value); if (saved) onDismissSaved(); }}
          onKeyDown={onKey}
          onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 200)}px`; }}
          placeholder="Write anything down…"
          aria-label="Capture a thought"
          enterKeyHint="done"
        />
        <Instrument tone="primary" onClick={() => void submit()} disabled={busy || !text.trim()}>Keep</Instrument>
      </div>
      {saved ? (
        <p className="capture2__after" role="status">
          <span className="capture2__saved">Kept as {WORD[saved.as]}.</span>{' '}
          <span className="capture2__offer">Make it {OTHERS[saved.as].map((k, i) => (
            <span key={k}>
              {i > 0 && (i === OTHERS[saved.as].length - 1 ? ' or ' : ', ')}
              <button type="button" className="capture2__link" onClick={() => void onReclassify(k)}>{WORD[k]}</button>
            </span>
          ))}?</span>
        </p>
      ) : (
        <p className="capture2__hint">Enter keeps it. Everything stays in this browser.</p>
      )}
    </div>
  );
}

import { useRef, useState, type KeyboardEvent } from 'react';
import { Instrument } from '@/components/Instrument';
import { isUrl } from '@/lib/text';

export type CaptureKind = 'note' | 'idea' | 'link' | 'memory';

const KINDS: { value: CaptureKind; label: string; placeholder: string }[] = [
  { value: 'note', label: 'Thought', placeholder: 'Write it down before it goes.' },
  { value: 'idea', label: 'Idea', placeholder: 'What if…' },
  { value: 'link', label: 'Link', placeholder: 'https://' },
  { value: 'memory', label: 'Memory', placeholder: 'Something that happened.' },
];

interface Props {
  onCapture: (kind: CaptureKind, text: string) => Promise<void>;
  large?: boolean;
  autoFocus?: boolean;
}

/** The fastest way in: one field, four kinds, Enter to keep it. */
export function Capture({ onCapture, large, autoFocus }: Props) {
  const [kind, setKind] = useState<CaptureKind>('note');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const meta = KINDS.find((k) => k.value === kind)!;

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    if (kind === 'link' && !isUrl(t.split(/\s/)[0] ?? '')) { setError('A link starts with http:// or https://'); return; }
    setBusy(true);
    try {
      await onCapture(kind, t);
      setText('');
      setError(null);
      ref.current?.focus();
    } finally {
      setBusy(false);
    }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); }
  };

  return (
    <div className={`capture ${large ? 'capture--large' : ''}`}>
      <div className="capture__kinds" role="radiogroup" aria-label="What kind of thing">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            role="radio"
            aria-checked={kind === k.value}
            className={`capture__kind ${kind === k.value ? 'is-active' : ''}`}
            onClick={() => { setKind(k.value); setError(null); ref.current?.focus(); }}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="capture__row">
        <textarea
          ref={ref}
          className="capture__input"
          rows={1}
          value={text}
          placeholder={meta.placeholder}
          aria-label="Capture a thought"
          autoFocus={autoFocus}
          onChange={(e) => { setText(e.target.value); setError(null); }}
          onKeyDown={onKey}
          onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 160)}px`; }}
        />
        <Instrument tone="primary" onClick={() => void submit()} disabled={busy || !text.trim()}>Keep</Instrument>
      </div>
      <p className="capture__hint">{error ?? 'Enter keeps it. Shift+Enter for a new line. Tags and threads come after.'}</p>
    </div>
  );
}

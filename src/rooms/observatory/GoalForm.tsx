import { useState, type FormEvent } from 'react';
import { Instrument } from '@/components/Instrument';
import { SelectField, TextArea, TextField } from '@/components/Field';
import type { Goal, Horizon } from '@/types';

const HORIZONS: { value: Horizon; label: string }[] = [
  { value: 'season', label: 'This season' },
  { value: 'year', label: 'This year' },
  { value: 'decade', label: 'This decade' },
  { value: 'lifetime', label: 'A lifetime' },
];

interface Props {
  initial?: Pick<Goal, 'title' | 'why' | 'horizon'>;
  submitLabel?: string;
  onSubmit: (values: { title: string; why: string; horizon: Horizon }) => void | Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export function GoalForm({ initial, submitLabel = 'Set it in the sky', onSubmit, onCancel, autoFocus = true }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [why, setWhy] = useState(initial?.why ?? '');
  const [horizon, setHorizon] = useState<Horizon>(initial?.horizon ?? 'year');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try { await onSubmit({ title: title.trim(), why: why.trim(), horizon }); } finally { setBusy(false); }
  };

  return (
    <form className="goal-form" onSubmit={submit}>
      <TextField label="Goal" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What are you steering by?" maxLength={120} autoFocus={autoFocus} required />
      <TextArea label="Why it matters" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="A sentence you will want to read on a hard day." maxLength={600} />
      <SelectField label="Horizon" value={horizon} onChange={(e) => setHorizon(e.target.value as Horizon)}>
        {HORIZONS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
      </SelectField>
      <div className="form-actions">
        <Instrument tone="primary" type="submit" disabled={busy || !title.trim()}>{submitLabel}</Instrument>
        {onCancel && <Instrument tone="quiet" type="button" onClick={onCancel}>Cancel</Instrument>}
      </div>
    </form>
  );
}

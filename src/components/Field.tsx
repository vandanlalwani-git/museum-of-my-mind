import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import './Field.css';

type Common = { label: string; hint?: string };

export function TextField({ label, hint, className = '', ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`field ${className}`}>
      <span className="plaque">{label}</span>
      <input className="field__input" {...rest} />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function TextArea({ label, hint, className = '', ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={`field ${className}`}>
      <span className="plaque">{label}</span>
      <textarea className="field__input field__textarea" rows={3} {...rest} />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function SelectField({ label, hint, className = '', children, ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={`field ${className}`}>
      <span className="plaque">{label}</span>
      <select className="field__input field__select" {...rest}>{children}</select>
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function RangeField({ label, hint, className = '', value, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`field ${className}`}>
      <span className="plaque">{label} <span className="tabular">{value}%</span></span>
      <input type="range" className="field__range" value={value} {...rest} />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

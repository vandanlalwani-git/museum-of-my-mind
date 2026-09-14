import type { ButtonHTMLAttributes } from 'react';
import './Instrument.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'default' | 'primary' | 'quiet' | 'ember';
};

/** Any interactive control. Thin gold hairline, parchment text, gold fill on active. */
export function Instrument({ tone = 'default', className = '', ...rest }: Props) {
  return <button className={`instrument instrument--${tone} ${className}`} {...rest} />;
}

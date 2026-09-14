import type { HTMLAttributes } from 'react';

/** The small engraved label under any object. */
export function Plaque({ className = '', ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={`plaque ${className}`} {...rest} />;
}

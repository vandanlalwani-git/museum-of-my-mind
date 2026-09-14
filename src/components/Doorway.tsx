import type { ReactNode } from 'react';
import './Doorway.css';

interface Props {
  eyebrow: string;
  title: string;
  description: ReactNode;
  footnote?: string;
  onOpen?: () => void;
  children?: ReactNode;
  emphasis?: boolean;
  as?: 'button' | 'div';
}

/** The large entrance choice. Hover brings a slow light bloom up from the threshold. */
export function Doorway({ eyebrow, title, description, footnote, onOpen, children, emphasis, as = 'button' }: Props) {
  const cls = `doorway ${emphasis ? 'doorway--emphasis' : ''} ${as === 'div' ? 'doorway--static' : ''}`;
  const inner = (
    <>
      <span className="doorway__arch" aria-hidden="true" />
      <span className="doorway__light" aria-hidden="true" />
      <span className="doorway__body">
        <span className="plaque doorway__eyebrow">{eyebrow}</span>
        <span className="doorway__title display">{title}</span>
        <span className="doorway__desc">{description}</span>
        {children}
        {footnote && <span className="doorway__foot">{footnote}</span>}
      </span>
    </>
  );
  if (as === 'div') return <div className={cls}>{inner}</div>;
  return (
    <button type="button" className={cls} onClick={onOpen}>
      {inner}
    </button>
  );
}

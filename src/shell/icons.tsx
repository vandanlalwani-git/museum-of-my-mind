/** Line icons drawn for the museum. Never emoji. */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, 'aria-hidden': true } as const;

export const SkyIcon = (p: P) => <svg {...base} {...p}><path d="M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9z" strokeLinejoin="round" /><circle cx="19" cy="5" r="1" fill="currentColor" stroke="none" /></svg>;
export const TodayIcon = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></svg>;
export const PlusIcon = (p: P) => <svg {...base} strokeWidth={2} {...p}><path d="M12 5v14M5 12h14" /></svg>;
export const JournalIcon = (p: P) => <svg {...base} {...p}><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h11" /></svg>;
export const SearchIcon = (p: P) => <svg {...base} {...p}><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></svg>;
export const GearIcon = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M5.5 18.5l2.1-2.1M16.4 7.6l2.1-2.1" /></svg>;
export const BackIcon = (p: P) => <svg {...base} {...p}><path d="M14.5 6l-6 6 6 6" /></svg>;
export const ListIcon = (p: P) => <svg {...base} {...p}><path d="M8 7h11M8 12h11M8 17h11" /><circle cx="4.5" cy="7" r="0.9" fill="currentColor" /><circle cx="4.5" cy="12" r="0.9" fill="currentColor" /><circle cx="4.5" cy="17" r="0.9" fill="currentColor" /></svg>;

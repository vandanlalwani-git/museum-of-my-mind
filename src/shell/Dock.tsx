import { NavLink } from 'react-router-dom';
import { useCapture } from './focus';
import { JournalIcon, PlusIcon, SearchIcon, SkyIcon, TodayIcon } from './icons';

/** The same five places, in the same order, on every screen. */
export function Dock() {
  const openCapture = useCapture((s) => s.openCapture);
  return (
    <nav className="dock plate" aria-label="Main">
      <NavLink to="/" end className="dock__item" data-dock="sky"><SkyIcon />Sky</NavLink>
      <NavLink to="/today" className="dock__item" data-dock="today"><TodayIcon />Today</NavLink>
      <button type="button" className="dock__item dock__capture" data-dock="capture" onClick={() => openCapture()} aria-label="Capture a thought (N)">
        <span className="dock__disc"><PlusIcon width={20} height={20} /></span>
        <span className="dock__kbd">N</span>
      </button>
      <NavLink to="/journal" className="dock__item" data-dock="journal"><JournalIcon />Journal</NavLink>
      <NavLink to="/search" className="dock__item" data-dock="search"><SearchIcon />Search</NavLink>
    </nav>
  );
}

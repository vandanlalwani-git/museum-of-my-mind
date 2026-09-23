import { NavLink } from 'react-router-dom';
import './Compass.css';

/**
 * Primary navigation: three places, not six rooms. Everything else lives one
 * step away behind Explore, which is deliberately quieter.
 */
const PRIMARY = [
  { to: '/', label: 'Today', end: true },
  { to: '/library', label: 'Library', end: false },
  { to: '/settings', label: 'Settings', end: false },
];

export function Compass() {
  return (
    <nav className="compass" aria-label="Main">
      {PRIMARY.map((p) => (
        <NavLink key={p.to} to={p.to} end={p.end} className={({ isActive }) => `compass__point ${isActive ? 'is-active' : ''}`}>
          <span className="compass__dot" aria-hidden="true" />
          {p.label}
        </NavLink>
      ))}
    </nav>
  );
}

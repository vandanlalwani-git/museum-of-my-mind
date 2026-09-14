import { NavLink } from 'react-router-dom';
import { ROOMS } from '@/types';
import './Compass.css';

/** The room navigator. Six points; the current room is lit gold. */
export function Compass() {
  return (
    <nav className="compass" aria-label="Rooms">
      <NavLink to="/" end className={({ isActive }) => `compass__point ${isActive ? 'is-active' : ''}`}>
        <span className="compass__dot" aria-hidden="true" />
        Entrance
      </NavLink>
      {ROOMS.map((r) => (
        <NavLink key={r.id} to={r.path} className={({ isActive }) => `compass__point ${isActive ? 'is-active' : ''}`}>
          <span className="compass__dot" aria-hidden="true" />
          {r.name}
        </NavLink>
      ))}
    </nav>
  );
}

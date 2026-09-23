import { Link as RouterLink } from 'react-router-dom';
import { useMuseumStore } from '@/store/museum';
import { useSettingsStore } from '@/store/settings';
import './explore.css';

/**
 * The rooms that are a pleasure rather than a daily habit. They are all still
 * here, in full; they simply no longer compete with Today for attention.
 */
export default function Explore() {
  const records = useMuseumStore((s) => s.records);
  const aiEnabled = useSettingsStore((s) => s.aiEnabled);
  const openActions = records.actions.filter((a) => !a.doneAt).length;
  const unfinished = records.projects.filter((p) => p.status !== 'done' && p.status !== 'abandoned').length;

  const rooms = [
    { to: '/observatory', name: 'Observatory', line: 'Your goals as constellations, with projects in orbit and the next step lit.', meta: `${records.goals.length} goals` },
    { to: '/archive', name: 'The wall', line: 'Notes, links, and memories with the threads you tie between them.', meta: `${records.notes.length + records.links.length + records.memories.length} items` },
    { to: '/workshop', name: 'Workshop', line: 'Unfinished projects as things on a bench, and what is worth picking up.', meta: `${unfinished} unfinished` },
    { to: '/future', name: 'Future Gallery', line: 'A what-if over a goal’s next year. A model you can argue with, never a forecast.', meta: `${records.scenarios.length} kept` },
    { to: '/cabinet', name: 'Cabinet of Curiosities', line: 'One forgotten drawer at a time, each with the reason it opened.', meta: `${openActions} steps open` },
  ];

  return (
    <section className="explore">
      <header className="explore__head">
        <span className="plaque">Every room is still here</span>
        <h1 className="explore__title">Explore</h1>
        <p className="explore__intent">Today keeps you moving. These are for when you want to stand back and look.</p>
      </header>

      <ul className="explore__rooms">
        {rooms.map((r) => (
          <li key={r.to}>
            <RouterLink to={r.to} className="explore__room">
              <span className="explore__room-head">
                <span className="explore__room-name display">{r.name}</span>
                <span className="plaque">{r.meta}</span>
              </span>
              <span className="explore__room-line">{r.line}</span>
            </RouterLink>
          </li>
        ))}
      </ul>

      <footer className="explore__foot">
        <RouterLink to="/reflect" className="explore__quiet">
          Ask my AI <span className="plaque">{aiEnabled ? 'on · bring your own key' : 'off'}</span>
        </RouterLink>
        <span className="explore__note">Optional, off by default, and never needed. The museum is complete without it.</span>
      </footer>
    </section>
  );
}

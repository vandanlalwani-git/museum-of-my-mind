import { Fragment } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useMind } from '@/mind/store';

interface Crumb { label: string; to?: string }

const PLACES: Record<string, string> = {
  '/today': 'Today', '/journal': 'Journal', '/search': 'Search', '/unsorted': 'Unsorted', '/clear': 'Clear my mind',
  '/settings': 'Settings', '/review': 'Your week',
};

/** Where you are: the museum, then the galaxy, goal and project you have moved into. */
export function Crumbs() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const snap = useMind((s) => s.snap);
  if (!snap) return null;
  const crumbs: Crumb[] = [{ label: snap.mind.name, to: '/' }];
  const galaxy = (id: string | null | undefined) => { const g = snap.galaxies.find((x) => x.id === id); if (g) crumbs.push({ label: g.name, to: `/?galaxy=${g.id}` }); };
  const goal = (id: string | null | undefined) => { const g = snap.goals.find((x) => x.id === id); if (g) { galaxy(g.galaxyId); crumbs.push({ label: g.title, to: `/goal/${g.id}` }); } return g; };

  const [, first, id] = pathname.split('/');
  if (pathname === '/' && params.get('galaxy')) galaxy(params.get('galaxy'));
  else if (first === 'goal') goal(id);
  else if (first === 'project') {
    const p = snap.projects.find((x) => x.id === id);
    if (p) { if (!goal(p.goalId)) galaxy(p.galaxyId); crumbs.push({ label: p.title }); }
  } else if (PLACES[pathname]) crumbs.push({ label: PLACES[pathname]! });

  return (
    <nav className="crumbs" aria-label="Where you are">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <Fragment key={`${c.label}-${i}`}>
            {i > 0 && <span className="crumbs__sep" aria-hidden="true">›</span>}
            {last || !c.to ? <span aria-current={last ? 'location' : undefined}>{c.label}</span> : <Link to={c.to}>{c.label}</Link>}
          </Fragment>
        );
      })}
    </nav>
  );
}

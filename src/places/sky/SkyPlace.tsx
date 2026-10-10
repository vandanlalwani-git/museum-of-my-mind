import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMind } from '@/mind/store';
import { useFocus } from '@/shell/focus';
import { useSky } from '@/sky/store';
import { SkyIndex } from './SkyIndex';
import { SkyOverlays } from './SkyOverlays';

/** Home: the living sky, or the same sky as a list. */
export default function SkyPlace() {
  const [params] = useSearchParams();
  const setFocus = useFocus((s) => s.setFocus);
  const live = useSky((s) => s.live);
  const mode = useSky((s) => s.mode);
  const snap = useMind((s) => s.snap);
  const galaxy = params.get('galaxy');
  const goalId = params.get('goal');
  const goalGalaxy = goalId ? snap?.goals.find((g) => g.id === goalId)?.galaxyId ?? null : null;
  useEffect(() => {
    setFocus({ galaxyId: galaxy ?? goalGalaxy, ...(goalId ? { goalId } : {}) });
  }, [galaxy, goalId, goalGalaxy, setFocus]);
  if (!live || mode === 'list') return <SkyIndex />;
  return <SkyOverlays />;
}

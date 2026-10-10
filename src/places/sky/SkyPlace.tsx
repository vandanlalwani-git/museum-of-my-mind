import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFocus } from '@/shell/focus';
import { SkyIndex } from './SkyIndex';

/** Home. For now the sky is shown as a list; the 3D sky joins it in a later phase. */
export default function SkyPlace() {
  const [params] = useSearchParams();
  const setFocus = useFocus((s) => s.setFocus);
  const galaxy = params.get('galaxy');
  useEffect(() => { setFocus({ galaxyId: galaxy }); }, [galaxy, setFocus]);
  return <SkyIndex />;
}

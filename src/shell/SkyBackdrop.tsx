import { Suspense, useCallback, useState } from 'react';
import { StarField } from '@/components/StarField';
import { lazyRoom } from '@/app/updates';
import { webglAvailable } from '@/lib/webgl';
import { useSky } from '@/sky/store';

const SkyStage = lazyRoom(() => import('@/sky/SkyStage'));

/** The sky behind every place: the living 3D sky, or a calm 2D field when 3D cannot be drawn. */
export function SkyBackdrop() {
  const [ok, setOk] = useState(() => webglAvailable());
  const fail = useCallback(() => { setOk(false); useSky.setState({ failed: true, live: false }); }, []);
  const calm = <StarField seed="mind" density={1.1} />;
  if (!ok) return calm;
  return <Suspense fallback={calm}><SkyStage onFail={fail} /></Suspense>;
}

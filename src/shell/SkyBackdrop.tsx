import { StarField } from '@/components/StarField';

/** The sky behind every place. A calm 2D field until the 3D sky arrives. */
export function SkyBackdrop() {
  return <StarField seed="mind" density={1.1} />;
}

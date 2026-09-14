import { RoomPlaceholder } from '@/rooms/RoomPlaceholder';
import { useMuseumStore } from '@/store/museum';

export default function FutureGallery() {
  const { goals } = useMuseumStore((s) => s.records);
  const active = goals.filter((g) => g.state === 'active').length;
  return (
    <RoomPlaceholder
      room="future"
      intent="Change one assumption and watch the museum rearrange. This is a model you can argue with, not a forecast."
      inventory={<>{active} active goals available to the model. The same inputs will always draw the same future.</>}
    />
  );
}

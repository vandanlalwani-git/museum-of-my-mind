import { RoomPlaceholder } from '@/rooms/RoomPlaceholder';
import { useMuseumStore } from '@/store/museum';

export default function Archive() {
  const { notes, links, threads } = useMuseumStore((s) => s.records);
  return (
    <RoomPlaceholder
      room="archive"
      intent="Notes, ideas, and links pinned to a wall, with threads between the ones that belong together."
      inventory={<>{notes.length} notes, {links.length} links, and {threads.length} threads between them.</>}
    />
  );
}

import { RoomPlaceholder } from '@/rooms/RoomPlaceholder';
import { useMuseumStore } from '@/store/museum';
import { relativeAge } from '@/lib/dates';

export default function Cabinet() {
  const { notes, links, memories, projects } = useMuseumStore((s) => s.records);
  const all = [...notes, ...links, ...memories, ...projects];
  const forgotten = [...all].sort((a, b) => a.lastVisitedAt - b.lastVisitedAt)[0];
  return (
    <RoomPlaceholder
      room="cabinet"
      intent="A drawer opens on something you forgot. One at a time. Keep it, revisit it, or let it go."
      inventory={<>{all.length} items in the drawers.{forgotten && 'title' in forgotten && <> The most forgotten is “{forgotten.title}”, untouched for {relativeAge(forgotten.lastVisitedAt).replace(' ago', '')}.</>}</>}
    />
  );
}

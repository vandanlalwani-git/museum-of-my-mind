import { RoomPlaceholder } from '@/rooms/RoomPlaceholder';
import { useMuseumStore } from '@/store/museum';

export default function Observatory() {
  const { goals, projects, actions } = useMuseumStore((s) => s.records);
  const open = actions.filter((a) => !a.doneAt).length;
  const done = actions.length - open;
  return (
    <RoomPlaceholder
      room="observatory"
      intent="Each goal becomes a constellation. Projects orbit it. The brightest point is the next thing to do."
      inventory={<>{goals.length} goals waiting to be drawn as stars, {projects.length} projects to set in orbit, and {open} next actions to light{done > 0 && <>, with {done} already done</>}.</>}
    />
  );
}

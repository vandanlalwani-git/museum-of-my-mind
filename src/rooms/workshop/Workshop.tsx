import { RoomPlaceholder } from '@/rooms/RoomPlaceholder';
import { useMuseumStore } from '@/store/museum';
import { relativeAge } from '@/lib/dates';

export default function Workshop() {
  const { projects } = useMuseumStore((s) => s.records);
  const unfinished = projects.filter((p) => p.status !== 'done');
  const dustiest = [...unfinished].sort((a, b) => a.lastVisitedAt - b.lastVisitedAt)[0];
  return (
    <RoomPlaceholder
      room="workshop"
      intent="Unfinished projects sit on benches as physical things. Dust settles on whatever you have not touched."
      inventory={<>{unfinished.length} unfinished projects on the benches.{dustiest && <> The dustiest is “{dustiest.title}”, last touched {relativeAge(dustiest.lastVisitedAt)}.</>}</>}
    />
  );
}

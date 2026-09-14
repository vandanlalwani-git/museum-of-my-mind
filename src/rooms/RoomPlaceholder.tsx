import type { ReactNode } from 'react';
import { ROOMS, type RoomId } from '@/types';
import './RoomPlaceholder.css';

interface Props { room: RoomId; intent: string; inventory: ReactNode }

/** Temporary room body until the room is built. Shows intent and what the collection holds for it. */
export function RoomPlaceholder({ room, intent, inventory }: Props) {
  const meta = ROOMS.find((r) => r.id === room)!;
  return (
    <section className="room">
      <header className="room__head">
        <span className="plaque">{meta.plaque}</span>
        <h1 className="room__title">{meta.name}</h1>
        <p className="room__intent">{intent}</p>
      </header>
      <div className="room__vitrine">
        <span className="plaque">Awaiting installation</span>
        <p className="room__inventory">{inventory}</p>
      </div>
    </section>
  );
}
